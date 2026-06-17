import json
import re
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.models.terraform import TerraformFile, TerraformResource

logger = logging.getLogger("backend.services.terraform")

def parse_provider(provider_str: str) -> str:
    """
    Cleans and extracts the provider name from tfstate provider string.
    e.g., 'provider["registry.terraform.io/hashicorp/aws"]' -> 'aws'
    """
    if not provider_str:
        return "unknown"
    
    # Extract contents inside quotes of provider["..."]
    match = re.search(r'provider\["([^"]+)"\]', provider_str)
    if match:
        provider_str = match.group(1)
        
    # Take the last segment after the slash, e.g., 'aws'
    parts = provider_str.split('/')
    return parts[-1].strip().lower()

def extract_region(attributes: dict, provider: str, resource_type: str) -> str:
    """
    Extracts regional location from resource attributes. Fallback to global/default values.
    """
    if not attributes:
        return "global" if provider == "aws" else "N/A"
    
    # 1. Direct checks for common region/location fields
    if "region" in attributes and attributes["region"]:
        return str(attributes["region"])
    if "location" in attributes and attributes["location"]:
        return str(attributes["location"])
        
    # 2. AWS ARN Parsing
    for key in ["arn", "arn_format", "id"]:
        val = attributes.get(key)
        if isinstance(val, str) and val.startswith("arn:aws:"):
            parts = val.split(":")
            if len(parts) > 3 and parts[3]:
                return parts[3]
                
    # 3. AWS Provider-specific heuristics
    if provider == "aws":
        # Global resources check
        global_types = {
            "aws_iam_role", "aws_iam_policy", "aws_iam_user", "aws_iam_group",
            "aws_route53_zone", "aws_cloudfront_distribution", "aws_s3_bucket" # S3 is technically global in namespace, but has regional endpoint. Often, we get region from ARN or default.
        }
        if resource_type in global_types and resource_type != "aws_s3_bucket":
            return "global"
            
        # Parse from S3 bucket domain/region if present
        if resource_type == "aws_s3_bucket":
            bucket_region = attributes.get("region") or attributes.get("bucket_domain_name")
            if bucket_region and "s3." in str(bucket_region):
                # e.g., s3.us-west-2.amazonaws.com
                match = re.search(r's3\.([a-z0-9\-]+)\.amazonaws', str(bucket_region))
                if match:
                    return match.group(1)
            
        # Availability Zone to Region (e.g. us-west-2a -> us-west-2)
        if "availability_zone" in attributes and attributes["availability_zone"]:
            az = str(attributes["availability_zone"])
            if az[-1].isalpha() and az[-2].isdigit():
                return az[:-1]
            return az
            
        return "us-east-1"  # Default AWS region fallback

    return "N/A"

def validate_and_parse_terraform(db: Session, user_id: int, file_name: str, file_contents: bytes) -> TerraformFile:
    """
    Validates file extension, structure, parses JSON tfstate and saves resources into the database.
    """
    lower_name = file_name.lower()
    
    # 1. Validate File extension
    if not (lower_name == "terraform.tfstate" or lower_name.endswith(".tfstate") or lower_name.endswith(".json")):
        raise ValueError("Invalid file type. Only terraform.tfstate, .tfstate, and .json files are allowed.")
        
    # 2. Parse file content as JSON
    data = None
    decoding_errors = []
    for encoding in ["utf-8", "utf-8-sig", "utf-16", "utf-16-le", "utf-16-be"]:
        try:
            decoded_text = file_contents.decode(encoding)
            data = json.loads(decoded_text)
            break
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            decoding_errors.append(f"{encoding}: {str(e)}")
            
    if data is None:
        logger.error(f"Failed to decode or parse JSON state file: {decoding_errors}")
        raise ValueError("Invalid file format. The file is not a valid JSON document.")
        
    if not isinstance(data, dict):
        raise ValueError("Invalid state structure. Root must be a JSON object.")
        
    if "resources" not in data or not isinstance(data["resources"], list):
        raise ValueError("Invalid Terraform state file. Missing 'resources' list.")

    # 3. Create File record
    file_type = "tfstate" if lower_name.endswith(".tfstate") else "json"
    db_file = TerraformFile(
        user_id=user_id,
        file_name=file_name,
        file_type=file_type,
        status="uploaded"
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    try:
        # 4. Iterate over resources and instances
        resources_to_insert = []
        for resource in data["resources"]:
            res_type = resource.get("type")
            res_name = resource.get("name")
            res_provider = parse_provider(resource.get("provider", ""))
            
            if not res_type or not res_name:
                continue
                
            instances = resource.get("instances", [])
            if not instances:
                # Edge case: Resource block declared with no deployed instances
                db_resource = TerraformResource(
                    file_id=db_file.id,
                    resource_type=res_type,
                    resource_name=res_name,
                    provider=res_provider,
                    region="N/A",
                    resource_metadata={},
                    status="Managed"
                )
                resources_to_insert.append(db_resource)
            else:
                for idx, inst in enumerate(instances):
                    attrs = inst.get("attributes", {})
                    # Build friendly display name with index if multiple instances exist
                    inst_name = res_name
                    index_key = inst.get("index_key")
                    if index_key is not None:
                        inst_name = f"{res_name}[{index_key}]"
                    elif len(instances) > 1:
                        inst_name = f"{res_name}[{idx}]"
                        
                    inst_region = extract_region(attrs, res_provider, res_type)
                    inst_status = "Managed"
                    if inst.get("status") == "deposed":
                        inst_status = "Deposed"
                        
                    db_resource = TerraformResource(
                        file_id=db_file.id,
                        resource_type=res_type,
                        resource_name=inst_name,
                        provider=res_provider,
                        region=inst_region,
                        resource_metadata=attrs,
                        status=inst_status
                    )
                    resources_to_insert.append(db_resource)
                    
        if resources_to_insert:
            db.add_all(resources_to_insert)
            db.commit()
            
            try:
                from backend.services.scanner_service import run_security_scan
                run_security_scan(db=db, file_id=db_file.id, user_id=user_id, resources=resources_to_insert)
            except Exception as scan_err:
                logger.error(f"Failed to scan resources for file #{db_file.id}: {scan_err}")
                
            try:
                from backend.services.cost_service import run_cost_analysis
                run_cost_analysis(db=db, file_id=db_file.id, user_id=user_id, resources=resources_to_insert)
            except Exception as cost_err:
                logger.error(f"Failed to run cost analysis for file #{db_file.id}: {cost_err}")
            
        db_file.status = "parsed"
        db.commit()
        db.refresh(db_file)
        
    except Exception as e:
        db_file.status = "failed"
        db.commit()
        logger.error(f"Error parsing Terraform state contents: {e}")
        raise ValueError(f"Failed to parse resources from Terraform state: {str(e)}")
        
    return db_file

def get_user_files(db: Session, user_id: int) -> List[TerraformFile]:
    """
    Returns list of all terraform files uploaded by a user.
    """
    return db.query(TerraformFile).filter(TerraformFile.user_id == user_id).order_by(TerraformFile.upload_time.desc()).all()

def get_file_by_id(db: Session, file_id: int, user_id: int) -> Optional[TerraformFile]:
    """
    Gets a single file belonging to the user.
    """
    return db.query(TerraformFile).filter(TerraformFile.id == file_id, TerraformFile.user_id == user_id).first()

def get_user_resources(db: Session, user_id: int) -> List[TerraformResource]:
    """
    Gets all parsed resources for all files uploaded by a user.
    """
    return db.query(TerraformResource).join(TerraformFile).filter(TerraformFile.user_id == user_id).all()

def get_file_resources(db: Session, file_id: int, user_id: int) -> List[TerraformResource]:
    """
    Gets parsed resources from a specific file belonging to the user.
    """
    return db.query(TerraformResource).join(TerraformFile).filter(
        TerraformResource.file_id == file_id,
        TerraformFile.user_id == user_id
    ).all()

def delete_user_file(db: Session, file_id: int, user_id: int) -> bool:
    """
    Deletes the file metadata and record from DB, cascading to clean up resources.
    """
    file_record = get_file_by_id(db, file_id, user_id)
    if not file_record:
        return False
        
    db.delete(file_record)
    db.commit()
    logger.info(f"Successfully deleted terraform file #{file_id} and its associated resources.")
    return True
