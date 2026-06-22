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
        
        test_user = db.query(User).filter(User.email == "normal_user@example.com").first()
        if test_user:
            db.delete(test_user)
            
        test_admin = db.query(User).filter(User.email == "admin_user@example.com").first()
        if test_admin:
            db.delete(test_admin)
            
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
        
        test_user = db.query(User).filter(User.email == "normal_user@example.com").first()
        if test_user:
            db.delete(test_user)
            
        test_admin = db.query(User).filter(User.email == "admin_user@example.com").first()
        if test_admin:
            db.delete(test_admin)
            
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
