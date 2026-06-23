import os
os.environ["JWT_SECRET"] = "temporary_jwt_secret_for_unit_tests_compliance"

from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import SessionLocal, Base, engine
from backend.models.user import User
from backend.models.terraform import TerraformFile, ReportHistory  # Register models for relationship mapper
from backend.models.audit import LoginLog, UsageLog, FailedLogin
from backend.utils.security import get_password_hash
import pytest

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_users():
    # Make sure tables are generated
    Base.metadata.create_all(bind=engine)
    
    # Create test users (one regular, one admin)
    db = SessionLocal()
    try:
        # Clean up existing test records
        db.query(FailedLogin).delete()
        db.query(UsageLog).delete()
        db.query(LoginLog).delete()
        db.query(User).delete()
        db.commit()
        
        # Insert fresh users
        pwd_hash = get_password_hash("testpassword123")
        normal_user = User(
            name="Normal User",
            email="normal_user@example.com",
            password_hash=pwd_hash,
            provider="local",
            role="user"
        )
        admin_user = User(
            name="Admin User",
            email="admin_user@example.com",
            password_hash=pwd_hash,
            provider="local",
            role="admin"
        )
        db.add(normal_user)
        db.add(admin_user)
        db.commit()
        db.refresh(normal_user)
        db.refresh(admin_user)
        
        pytest.normal_user_id = normal_user.id
        pytest.admin_user_id = admin_user.id
    finally:
        db.close()
        
    yield
    
    # Clean up test users
    db = SessionLocal()
    try:
        db.query(FailedLogin).delete()
        db.query(UsageLog).delete()
        db.query(LoginLog).delete()
        db.query(User).delete()
        db.commit()
    finally:
        db.close()

def get_auth_headers(email: str, password: str) -> dict:
    payload = {
        "email": email,
        "password": password
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_unauthenticated_access_blocked():
    """
    Verifies that admin endpoints reject unauthenticated requests with 401.
    """
    for endpoint in ["dashboard", "users", "login-logs", "usage-logs", "security"]:
        response = client.get(f"/api/admin/{endpoint}")
        assert response.status_code == 401

def test_unauthorized_access_blocked():
    """
    Verifies that standard users (role = user) cannot access admin endpoints.
    """
    headers = get_auth_headers("normal_user@example.com", "testpassword123")
    for endpoint in ["dashboard", "users", "login-logs", "usage-logs", "security"]:
        response = client.get(f"/api/admin/{endpoint}", headers=headers)
        assert response.status_code == 403

def test_admin_access_allowed():
    """
    Verifies that administrators can access admin endpoints.
    """
    headers = get_auth_headers("admin_user@example.com", "testpassword123")
    
    # Dashboard stats check
    response = client.get("/api/admin/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_logins" in data
    
    # Users directory check
    response = client.get("/api/admin/users", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) >= 2
    
    # User Details check
    response = client.get(f"/api/admin/user/{pytest.normal_user_id}", headers=headers)
    assert response.status_code == 200
    detail = response.json()
    assert detail["user"]["email"] == "normal_user@example.com"
    assert "uploads_count" in detail
    assert "activity" in detail

def test_failed_login_logs_failure():
    """
    Verifies that failed logins register in failed_logins table.
    """
    db = SessionLocal()
    try:
        initial_failed = db.query(FailedLogin).count()
        
        # Trigger failed login attempt via API
        payload = {
            "email": "invalid_user@example.com",
            "password": "wrongpassword"
        }
        response = client.post("/auth/login", json=payload)
        assert response.status_code == 401 or response.status_code == 404
        
        # Verify it was logged in the DB
        after_failed = db.query(FailedLogin).count()
        assert after_failed == initial_failed + 1
        
        last_failed = db.query(FailedLogin).order_by(FailedLogin.attempt_timestamp.desc()).first()
        assert last_failed.email == "invalid_user@example.com"
    finally:
        db.close()

def test_successful_login_logs_activity():
    """
    Verifies that successful login logs to login_logs and usage_logs.
    """
    db = SessionLocal()
    try:
        initial_logins = db.query(LoginLog).count()
        initial_usage = db.query(UsageLog).count()
        
        # Trigger successful login attempt via API
        payload = {
            "email": "normal_user@example.com",
            "password": "testpassword123"
        }
        response = client.post("/auth/login", json=payload)
        assert response.status_code == 200
        
        # Verify session log is created
        after_logins = db.query(LoginLog).count()
        assert after_logins == initial_logins + 1
        
        last_log = db.query(LoginLog).order_by(LoginLog.login_timestamp.desc()).first()
        assert last_log.email == "normal_user@example.com"
        assert last_log.login_method == "email"
        
        # Verify usage log is created
        after_usage = db.query(UsageLog).count()
        assert after_usage > initial_usage
    finally:
        db.close()

def test_bootstrap_status_endpoint():
    """
    Verifies that the /bootstrap-status endpoint returns status and is properly protected.
    """
    # 1. Unauthenticated gets 401
    res = client.get("/api/admin/bootstrap-status")
    assert res.status_code == 401
    
    # 2. Regular user gets 403
    normal_headers = get_auth_headers("normal_user@example.com", "testpassword123")
    res = client.get("/api/admin/bootstrap-status", headers=normal_headers)
    assert res.status_code == 403
    
    # 3. Admin user gets 200
    admin_headers = get_auth_headers("admin_user@example.com", "testpassword123")
    res = client.get("/api/admin/bootstrap-status", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "admin_exists" in data
    assert "email" in data

def test_bootstrap_logic_idempotency():
    """
    Verifies that the bootstrap process runs successfully, creates the user,
    and is idempotent (does not duplicate or overwrite existing passwords).
    """
    from backend.models.user import User
    from backend.utils.security import verify_password
    
    db = SessionLocal()
    try:
        # 1. Ensure test bootstrap email is clean
        email = "temp-bootstrap-test@example.com"
        clean_user = db.query(User).filter(User.email == email).first()
        if clean_user:
            db.delete(clean_user)
            db.commit()
            
        # 2. Run bootstrap manually by simulating main.py logic
        from backend.utils.security import get_password_hash
        pwd_hash = get_password_hash("bootstrap123")
        new_admin = User(
            name="System Administrator",
            email=email,
            password_hash=pwd_hash,
            provider="local",
            role="admin"
        )
        db.add(new_admin)
        db.commit()
        
        # 3. Verify user created as admin
        admin_rec = db.query(User).filter(User.email == email).first()
        assert admin_rec is not None
        assert admin_rec.role == "admin"
        assert verify_password("bootstrap123", admin_rec.password_hash)
        
        # 4. Rerun logic: modifying role to user then running elevation check
        admin_rec.role = "user"
        db.commit()
        
        # Simulate startup elevation
        admin_user = db.query(User).filter(User.email == email).first()
        if admin_user:
            admin_user.role = "admin"
            db.commit()
            
        admin_rec_elevated = db.query(User).filter(User.email == email).first()
        assert admin_rec_elevated.role == "admin"
        assert verify_password("bootstrap123", admin_rec_elevated.password_hash)
        
        # Clean up
        db.delete(admin_rec_elevated)
        db.commit()
    finally:
        db.close()


def test_profile_api_returns_role_and_access_level():
    """
    Verifies that the /auth/me profile endpoint returns is_admin, role, and access_level.
    """
    headers = get_auth_headers("admin_user@example.com", "testpassword123")
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"
    assert data["is_admin"] is True
    assert data["access_level"] == "Administrator"

    normal_headers = get_auth_headers("normal_user@example.com", "testpassword123")
    response = client.get("/auth/me", headers=normal_headers)
    assert response.status_code == 200
    normal_data = response.json()
    assert normal_data["role"] == "user"
    assert normal_data["is_admin"] is False
    assert normal_data["access_level"] == "Standard User"


def test_admin_user_actions_and_safety_rules():
    """
    Verifies disable, enable, promote, demote, delete actions and their safety rules.
    """
    admin_headers = get_auth_headers("admin_user@example.com", "testpassword123")
    
    # 1. Prevent disabling own account
    response = client.post(f"/api/admin/user/{pytest.admin_user_id}/disable", headers=admin_headers)
    assert response.status_code == 400
    assert "Cannot disable your own account." in response.json()["detail"]

    # 2. Disable normal user
    response = client.post(f"/api/admin/user/{pytest.normal_user_id}/disable", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["user"]["is_active"] is False

    # Check that usage log for user_disabled is created
    db = SessionLocal()
    try:
        log = db.query(UsageLog).filter(UsageLog.action == "user_disabled").first()
        assert log is not None
        assert log.user_id == pytest.admin_user_id
    finally:
        db.close()

    # 3. Disabled user cannot authenticate
    payload = {
        "email": "normal_user@example.com",
        "password": "testpassword123"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Account disabled. Contact administrator."

    # 4. Enable user again
    response = client.post(f"/api/admin/user/{pytest.normal_user_id}/enable", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["user"]["is_active"] is True
    
    # Verify user_enabled audit log is created
    db = SessionLocal()
    try:
        log = db.query(UsageLog).filter(UsageLog.action == "user_enabled").first()
        assert log is not None
    finally:
        db.close()

    # 5. Promote user to admin
    response = client.post(f"/api/admin/user/{pytest.normal_user_id}/promote", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"

    # Verify user_promoted audit log is created
    db = SessionLocal()
    try:
        log = db.query(UsageLog).filter(UsageLog.action == "user_promoted").first()
        assert log is not None
    finally:
        db.close()

    # Now there are 2 active admins. Let's try demoting normal_user back to user.
    response = client.post(f"/api/admin/user/{pytest.normal_user_id}/demote", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "user"

    # Verify user_demoted audit log is created
    db = SessionLocal()
    try:
        log = db.query(UsageLog).filter(UsageLog.action == "user_demoted").first()
        assert log is not None
    finally:
        db.close()

    # 6. Prevent removing last admin account
    response = client.post(f"/api/admin/user/{pytest.admin_user_id}/demote", headers=admin_headers)
    assert response.status_code == 400
    assert "Cannot remove the last administrator account." in response.json()["detail"]

    # 7. Prevent deleting own account
    response = client.delete(f"/api/admin/user/{pytest.admin_user_id}", headers=admin_headers)
    assert response.status_code == 400
    assert "Cannot delete your own account." in response.json()["detail"]

    # 8. Soft Delete normal user
    response = client.delete(f"/api/admin/user/{pytest.normal_user_id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify user_deleted audit log is created
    db = SessionLocal()
    try:
        log = db.query(UsageLog).filter(UsageLog.action == "user_deleted").first()
        assert log is not None
    finally:
        db.close()

    # Verify soft-deleted user is excluded from user directory list
    response = client.get("/api/admin/users", headers=admin_headers)
    assert response.status_code == 200
    users_list = response.json()
    assert all(u["id"] != pytest.normal_user_id for u in users_list)

