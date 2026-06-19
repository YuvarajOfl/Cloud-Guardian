import json
import logging
from sqlalchemy.orm import Session
from backend.models.terraform import TerraformResource, SecurityFinding

logger = logging.getLogger("backend.services.scanner")

def is_s3_bucket_match(bucket_name: str, bucket_val: str, bucket_ref: str) -> bool:
    if not bucket_ref:
        return False
    bucket_ref = str(bucket_ref).strip()
    # Clean references like aws_s3_bucket.demo.id or aws_s3_bucket.demo.bucket -> demo
    clean_ref = bucket_ref.replace("aws_s3_bucket.", "").replace(".id", "").replace(".bucket", "").strip()
    
    if clean_ref == bucket_name:
        return True
    if bucket_ref == bucket_name:
        return True
    if bucket_val and clean_ref == str(bucket_val):
        return True
    if bucket_val and bucket_ref == str(bucket_val):
        return True
    return False

def run_security_scan(db: Session, file_id: int, user_id: int, resources: list[TerraformResource]) -> list[SecurityFinding]:
    """
    Scans a list of parsed Terraform resources for common security vulnerabilities
    and saves any findings to the database. Supports HCL workspace cross-resource matching.
    """
    findings = []
    
    # Pre-parse S3 configurations for workspace-wide HCL cross-referencing
    s3_public_access_blocks = {}
    s3_encryption_configs = {}
    
    for r in resources:
        r_attrs = r.resource_metadata or {}
        if r.resource_type == "aws_s3_bucket_public_access_block":
            bucket_ref = r_attrs.get("bucket")
            if bucket_ref:
                s3_public_access_blocks[str(bucket_ref)] = r_attrs
        elif r.resource_type == "aws_s3_bucket_server_side_encryption_configuration":
            bucket_ref = r_attrs.get("bucket")
            if bucket_ref:
                s3_encryption_configs[str(bucket_ref)] = r_attrs
    
    for resource in resources:
        res_type = resource.resource_type
        res_name = resource.resource_name
        attrs = resource.resource_metadata or {}
        # Fallback file_id
        target_file_id = resource.file_id or file_id
        
        # 1. AWS Security Group (inline rules check)
        if res_type == "aws_security_group":
            ingress_rules = attrs.get("ingress", [])
            if isinstance(ingress_rules, dict):
                ingress_rules = [ingress_rules]
            elif not isinstance(ingress_rules, list):
                ingress_rules = []
                
            for rule in ingress_rules:
                if not isinstance(rule, dict):
                    continue
                cidr_blocks = rule.get("cidr_blocks", [])
                ipv6_cidr_blocks = rule.get("ipv6_cidr_blocks", [])
                from_port = rule.get("from_port")
                to_port = rule.get("to_port")
                protocol = rule.get("protocol", "tcp")
                
                is_open = False
                if isinstance(cidr_blocks, list) and "0.0.0.0/0" in cidr_blocks:
                    is_open = True
                if isinstance(ipv6_cidr_blocks, list) and "::/0" in ipv6_cidr_blocks:
                    is_open = True
                    
                if is_open:
                    if from_port == 22 or to_port == 22 or (from_port is not None and to_port is not None and from_port <= 22 <= to_port):
                        findings.append(SecurityFinding(
                            user_id=user_id,
                            file_id=target_file_id,
                            resource_name=res_name,
                            resource_type=res_type,
                            severity="High",
                            title="Insecure Security Group Rule (SSH open to world)",
                            description="Security group allows SSH traffic (port 22) from any IP address (0.0.0.0/0). This exposes the instance to brute-force attacks from the internet.",
                            recommendation="Restrict SSH ingress (port 22) cidr_blocks to specific trusted IP ranges or corporate network blocks instead of 0.0.0.0/0."
                        ))
                    elif from_port == 3389 or to_port == 3389 or (from_port is not None and to_port is not None and from_port <= 3389 <= to_port):
                        findings.append(SecurityFinding(
                            user_id=user_id,
                            file_id=target_file_id,
                            resource_name=res_name,
                            resource_type=res_type,
                            severity="High",
                            title="Insecure Security Group Rule (RDP open to world)",
                            description="Security group allows RDP traffic (port 3389) from any IP address (0.0.0.0/0). This exposes the instance to potential remote desktop exploit attempts.",
                            recommendation="Restrict RDP ingress (port 3389) cidr_blocks to specific trusted IP ranges."
                        ))
                    elif from_port == 0 or to_port == 0 or protocol == "-1" or (from_port == 1 and to_port == 65535):
                        findings.append(SecurityFinding(
                            user_id=user_id,
                            file_id=target_file_id,
                            resource_name=res_name,
                            resource_type=res_type,
                            severity="Critical",
                            title="Insecure Security Group Rule (All Ports open to world)",
                            description="Security group allows all inbound traffic on all ports from any IP address. This completely exposes resources associated with this security group.",
                            recommendation="Restrict ingress rules to only allow required ports and limit sources to trusted CIDR blocks."
                        ))
                    else:
                        is_web = (from_port == 80 and to_port == 80) or (from_port == 443 and to_port == 443)
                        if not is_web:
                            port_str = f"port {from_port}" if from_port == to_port else f"ports {from_port}-{to_port}"
                            findings.append(SecurityFinding(
                                user_id=user_id,
                                file_id=target_file_id,
                                resource_name=res_name,
                                resource_type=res_type,
                                severity="Medium",
                                title=f"Security Group Rule Open to Public ({port_str})",
                                description=f"Security group allows public ingress traffic on {port_str} ({protocol}) from 0.0.0.0/0. Exposing ports to the public increases the resource attack surface.",
                                recommendation="Limit access to trusted source CIDR blocks or specific security groups."
                            ))
                            
        # 2. AWS Security Group Rule (separate resource)
        elif res_type == "aws_security_group_rule":
            rule_type = attrs.get("type")
            if rule_type == "ingress":
                cidr_blocks = attrs.get("cidr_blocks", [])
                ipv6_cidr_blocks = attrs.get("ipv6_cidr_blocks", [])
                from_port = attrs.get("from_port")
                to_port = attrs.get("to_port")
                protocol = attrs.get("protocol", "tcp")
                
                is_open = False
                if isinstance(cidr_blocks, list) and "0.0.0.0/0" in cidr_blocks:
                    is_open = True
                if isinstance(ipv6_cidr_blocks, list) and "::/0" in ipv6_cidr_blocks:
                    is_open = True
                    
                if is_open:
                    if from_port == 22 or to_port == 22 or (from_port is not None and to_port is not None and from_port <= 22 <= to_port):
                        findings.append(SecurityFinding(
                            user_id=user_id,
                            file_id=target_file_id,
                            resource_name=res_name,
                            resource_type=res_type,
                            severity="High",
                            title="Insecure Security Group Rule (SSH open to world)",
                            description="Security group rule allows SSH traffic (port 22) from any IP address (0.0.0.0/0). This exposes the instance to brute-force attacks.",
                            recommendation="Restrict SSH ingress (port 22) to specific trusted CIDR ranges."
                        ))
                    elif from_port == 3389 or to_port == 3389 or (from_port is not None and to_port is not None and from_port <= 3389 <= to_port):
                        findings.append(SecurityFinding(
                            user_id=user_id,
                            file_id=target_file_id,
                            resource_name=res_name,
                            resource_type=res_type,
                            severity="High",
                            title="Insecure Security Group Rule (RDP open to world)",
                            description="Security group rule allows RDP traffic (port 3389) from any IP address (0.0.0.0/0).",
                            recommendation="Restrict RDP ingress (port 3389) to specific trusted CIDR ranges."
                        ))
                    elif from_port == 0 or to_port == 0 or protocol == "-1":
                        findings.append(SecurityFinding(
                            user_id=user_id,
                            file_id=target_file_id,
                            resource_name=res_name,
                            resource_type=res_type,
                            severity="Critical",
                            title="Insecure Security Group Rule (All Ports open to world)",
                            description="Security group rule allows all inbound traffic from any IP address on all ports.",
                            recommendation="Restrict ingress rules to specific ports and trusted sources."
                        ))

        # 3. AWS S3 Bucket
        elif res_type == "aws_s3_bucket":
            # Public Access configuration checks
            acl = attrs.get("acl")
            is_public = False
            sev = "High"
            
            if acl in ["public-read", "public-read-write"]:
                is_public = True
                sev = "Critical" if acl == "public-read-write" else "High"
            else:
                # Check workspace for S3 Public Access Block configuration
                matching_block = None
                for ref, block_attrs in s3_public_access_blocks.items():
                    if is_s3_bucket_match(res_name, attrs.get("bucket", ""), ref):
                        matching_block = block_attrs
                        break
                
                if matching_block:
                    b_acls = matching_block.get("block_public_acls")
                    b_policy = matching_block.get("block_public_policy")
                    # Check if either explicitly set to False/false
                    if b_acls in [False, "false"] or b_policy in [False, "false"]:
                        is_public = True
                        sev = "High"
                else:
                    # In HCL source code, a missing public access block resource is a warning/high severity risk
                    is_public = True
                    sev = "High"
            
            if is_public:
                findings.append(SecurityFinding(
                    user_id=user_id,
                    file_id=target_file_id,
                    resource_name=res_name,
                    resource_type=res_type,
                    severity=sev,
                    title="S3 Bucket Publicly Accessible",
                    description=f"The S3 bucket has ACL '{acl or 'default'}' or missing/insecure Public Access Block configuration. Anyone on the internet can access this bucket.",
                    recommendation="Remove public ACLs and configure S3 Block Public Access settings (block_public_acls = true, block_public_policy = true) unless this bucket is intended to host public website assets."
                ))
            
            # SSE Configuration Check
            has_encryption = False
            sse_config = attrs.get("server_side_encryption_configuration", [])
            if sse_config:
                has_encryption = True
            else:
                # Check workspace for S3 encryption configuration resource
                for ref, sse_attrs in s3_encryption_configs.items():
                    if is_s3_bucket_match(res_name, attrs.get("bucket", ""), ref):
                        has_encryption = True
                        break
            
            if not has_encryption:
                findings.append(SecurityFinding(
                    user_id=user_id,
                    file_id=target_file_id,
                    resource_name=res_name,
                    resource_type=res_type,
                    severity="Medium",
                    title="S3 Bucket Server-Side Encryption Disabled",
                    description="S3 bucket does not have default server-side encryption enabled. Static files are stored in plaintext on disk.",
                    recommendation="Enable default AES256 or KMS server-side encryption for the S3 bucket."
                ))

        # 4. AWS RDS Database
        elif res_type == "aws_db_instance":
            publicly_accessible = attrs.get("publicly_accessible", False)
            if publicly_accessible in [True, "true"]:
                findings.append(SecurityFinding(
                    user_id=user_id,
                    file_id=target_file_id,
                    resource_name=res_name,
                    resource_type=res_type,
                    severity="High",
                    title="RDS Database Publicly Accessible",
                    description="The RDS database instance has 'publicly_accessible' set to true, making it reachable from the public internet. Database servers should always reside in private subnets.",
                    recommendation="Set 'publicly_accessible' to false. Access the database only within a private VPC network or via database proxies/bastions."
                ))
                
            storage_encrypted = attrs.get("storage_encrypted", False)
            if storage_encrypted not in [True, "true"]:
                findings.append(SecurityFinding(
                    user_id=user_id,
                    file_id=target_file_id,
                    resource_name=res_name,
                    resource_type=res_type,
                    severity="Medium",
                    title="RDS Storage Encryption Disabled",
                    description="The RDS instance storage is not encrypted. Data-at-rest and database backups will not be encrypted, exposing them to physical theft or unauthorized access.",
                    recommendation="Enable storage encryption (AES-256) when creating the RDS instance."
                ))

        # 5. AWS IAM Policy
        elif res_type in ["aws_iam_policy", "aws_iam_role_policy", "aws_iam_user_policy"]:
            policy_val = attrs.get("policy")
            if policy_val:
                policy_doc = {}
                if isinstance(policy_val, str):
                    try:
                        policy_doc = json.loads(policy_val)
                    except json.JSONDecodeError:
                        pass
                elif isinstance(policy_val, dict):
                    policy_doc = policy_val
                
                statements = policy_doc.get("Statement", [])
                if isinstance(statements, dict):
                    statements = [statements]
                elif not isinstance(statements, list):
                    statements = []
                    
                has_admin = False
                for stmt in statements:
                    effect = stmt.get("Effect")
                    action = stmt.get("Action", [])
                    resource = stmt.get("Resource", [])
                    
                    if effect == "Allow":
                        actions_all = False
                        if action == "*":
                            actions_all = True
                        elif isinstance(action, list) and "*" in action:
                            actions_all = True
                            
                        resource_all = False
                        if resource == "*":
                            resource_all = True
                        elif isinstance(resource, list) and "*" in resource:
                            resource_all = True
                            
                        if actions_all and resource_all:
                            has_admin = True
                            break
                            
                if has_admin:
                    findings.append(SecurityFinding(
                        user_id=user_id,
                        file_id=target_file_id,
                        resource_name=res_name,
                        resource_type=res_type,
                        severity="Critical",
                        title="IAM Policy Grants Wildcard Admin Privileges",
                        description="The IAM policy allows all actions ('*') on all resources ('*'). This is equivalent to administrator access and violates the principle of least privilege.",
                        recommendation="Narrow the scope of the policy to grant only the specific API actions and resources required for execution."
                    ))

    if findings:
        db.add_all(findings)
        db.commit()
        logger.info(f"Registered {len(findings)} security findings.")
        
    return findings
