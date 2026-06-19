import requests
import sys
import subprocess
import time
import os

from backend.services.terraform_service import resolve_hcl_variables

API_URL = "http://localhost:8000"

def test_variable_resolution():
    print("Testing HCL Variable Resolution...")
    variables = {
        "env": "prod",
        "port": 22,
        "bucket_name": "infrasight-secure-bucket"
    }
    raw_config = {
        "bucket": "var.bucket_name",
        "name": "${var.env}-s3",
        "ingress": {
            "from_port": "var.port",
            "to_port": 22
        }
    }
    resolved = resolve_hcl_variables(raw_config, variables)
    assert resolved["bucket"] == "infrasight-secure-bucket"
    assert resolved["name"] == "prod-s3"
    assert resolved["ingress"]["from_port"] == 22
    assert resolved["ingress"]["to_port"] == 22
    print("HCL Variable Resolution test: PASSED")

def test_integration():
    print("Testing HCL upload and workspace view endpoints via API...")
    
    # 1. Login
    login_resp = requests.post(f"{API_URL}/auth/google", json={"google_token": "sandbox_developer_token"})
    if login_resp.status_code != 200:
        print(f"Login failed: {login_resp.status_code} - {login_resp.text}")
        sys.exit(1)
        
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload main.tf
    main_tf_content = """
    variable "bucket_name" {
      default = "my-test-default-bucket"
    }
    resource "aws_s3_bucket" "my_bucket" {
      bucket = var.bucket_name
    }
    """
    
    files = {"file": ("main.tf", main_tf_content.encode("utf-8"), "text/plain")}
    upload_resp = requests.post(
        f"{API_URL}/api/upload",
        headers=headers,
        files=files,
        params={"upload_action": "replace"}
    )
    assert upload_resp.status_code == 201, f"Upload main.tf failed: {upload_resp.text}"
    file_id = upload_resp.json()["id"]

    # 3. Retrieve resources and verify it contains default value
    res_resp = requests.get(f"{API_URL}/api/resources/{file_id}", headers=headers)
    assert res_resp.status_code == 200, f"Get resources failed: {res_resp.status_code} - {res_resp.text}"
    resources = res_resp.json()
    assert len(resources) >= 1
    bucket_res = [r for r in resources if r["resource_name"] == "my_bucket"]
    assert len(bucket_res) == 1
    assert bucket_res[0]["resource_metadata"]["bucket"] == "my-test-default-bucket"

    # 4. Upload terraform.tfvars (HCL override)
    tfvars_content = """
    bucket_name = "overridden-hcl-bucket"
    """
    files_vars = {"file": ("terraform.tfvars", tfvars_content.encode("utf-8"), "text/plain")}
    upload_vars_resp = requests.post(
        f"{API_URL}/api/upload",
        headers=headers,
        files=files_vars,
        params={"upload_action": "replace"}
    )
    assert upload_vars_resp.status_code == 201, f"Upload terraform.tfvars failed: {upload_vars_resp.text}"

    # 5. Retrieve resources again for main.tf file_id
    # We should see overridden variable because HCL is aggregated workspace-wide!
    res_resp = requests.get(f"{API_URL}/api/resources/{file_id}", headers=headers)
    assert res_resp.status_code == 200, f"Get resources second time failed: {res_resp.status_code} - {res_resp.text}"
    resources = res_resp.json()
    assert len(resources) >= 1
    bucket_res = [r for r in resources if r["resource_name"] == "my_bucket"]
    assert len(bucket_res) == 1
    assert bucket_res[0]["resource_metadata"]["bucket"] == "overridden-hcl-bucket"
    
    print("Integration endpoints aggregation test: PASSED")

def main():
    test_variable_resolution()
    
    # Check if backend server is already running, if not start it
    server_started_by_us = False
    proc = None
    try:
        requests.get(f"{API_URL}/")
    except requests.exceptions.ConnectionError:
        print("Starting FastAPI backend server...")
        # Start server as subprocess
        proc = subprocess.Popen(
            [r".\backend\venv\Scripts\python", "-m", "uvicorn", "backend.main:app", "--port", "8000"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        server_started_by_us = True
        time.sleep(3) # Wait for server startup

    try:
        test_integration()
    finally:
        if server_started_by_us and proc:
            print("Stopping backend server...")
            proc.terminate()
            proc.wait()

if __name__ == "__main__":
    main()
