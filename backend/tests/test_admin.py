import requests
import sys
import subprocess
import time
import os
import pytest
from backend.database.session import SessionLocal, Base, engine
from backend.models.user import User
from backend.models.terraform import TerraformFile, ReportHistory  # Register models for relationship mapper
from backend.models.audit import LoginLog, UsageLog, FailedLogin
from backend.utils.security import get_password_hash

API_URL = "http://localhost:8000"

def is_localhost_running():
    try:
        response = requests.get(API_URL, timeout=1)
        return response.status_code == 200
    except Exception:
        return False

@pytest.fixture(scope="module", autouse=True)
def manage_server():
    server_started_by_us = False
    proc = None
    if not is_localhost_running():
        print("Starting FastAPI backend server...")
        # Start server as subprocess using current system python executable
        python_exe = sys.executable
        proc = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        server_started_by_us = True
        
        # Wait up to 15 seconds for uvicorn to bind and listen
        for _ in range(15):
            time.sleep(1)
            if is_localhost_running():
                break
        
    yield
    
    if server_started_by_us and proc:
        print("Stopping backend server...")
        proc.terminate()
        proc.wait()

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

def get_auth_token(email: str, password: str) -> str:
    payload = {
        "email": email,
        "password": password
    }
    response = requests.post(f"{API_URL}/auth/login", json=payload)
    assert response.status_code == 200
    return response.json()["access_token"]

def test_unauthenticated_access_blocked():
    """
    Verifies that admin endpoints reject unauthenticated requests with 401.
    """
    for endpoint in ["dashboard", "users", "login-logs", "usage-logs", "security"]:
        response = requests.get(f"{API_URL}/api/admin/{endpoint}")
        assert response.status_code == 401

def test_unauthorized_access_blocked():
    """
    Verifies that standard users (role = user) cannot access admin endpoints.
    """
    token = get_auth_token("normal_user@example.com", "testpassword123")
    headers = {"Authorization": f"Bearer {token}"}
    for endpoint in ["dashboard", "users", "login-logs", "usage-logs", "security"]:
        response = requests.get(f"{API_URL}/api/admin/{endpoint}", headers=headers)
        assert response.status_code == 403

def test_admin_access_allowed():
    """
    Verifies that administrators can access admin endpoints.
    """
    token = get_auth_token("admin_user@example.com", "testpassword123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Dashboard stats check
    response = requests.get(f"{API_URL}/api/admin/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_logins" in data
    
    # Users directory check
    response = requests.get(f"{API_URL}/api/admin/users", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) >= 2
    
    # User Details check
    response = requests.get(f"{API_URL}/api/admin/user/{pytest.normal_user_id}", headers=headers)
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
        response = requests.post(f"{API_URL}/auth/login", json=payload)
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
        response = requests.post(f"{API_URL}/auth/login", json=payload)
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
