import json
import logging
from sqlalchemy.orm import Session
from backend.models.terraform import TerraformResource, CostFinding

logger = logging.getLogger("backend.services.cost")

def run_cost_analysis(db: Session, file_id: int, user_id: int, resources: list[TerraformResource]) -> list[CostFinding]:
    """
    Scans a list of parsed Terraform resources for cost optimization opportunities
    and saves findings to the database.
    """
    findings = []
    
    # Pre-parse lists to help with relation-based rules (EBS Attachment, Security Group duplication)
    volume_attachments = []
    security_groups = []
    
    for resource in resources:
        if resource.resource_type == "aws_volume_attachment":
            volume_attachments.append(resource)
        elif resource.resource_type == "aws_security_group":
            security_groups.append(resource)

    # Gather set of attached volume IDs / logical volume names
    attached_volume_refs = set()
    for attachment in volume_attachments:
        attrs = attachment.resource_metadata or {}
        vol_id = attrs.get("volume_id")
        if vol_id:
            attached_volume_refs.add(str(vol_id))
            # If it references a logical resource, e.g. aws_ebs_volume.my_vol.id, extract name
            if "." in str(vol_id):
                parts = str(vol_id).split(".")
                if len(parts) > 1:
                    attached_volume_refs.add(parts[1])

    # Hash ingress rules for Security Group comparison
    sg_rules_map = {} # {canonical_rules_str: [security_group_resource]}
    
    for resource in resources:
        res_type = resource.resource_type
        res_name = resource.resource_name
        attrs = resource.resource_metadata or {}
        
        # 1. EC2 Instances
        if res_type == "aws_instance":
            instance_type = attrs.get("instance_type")
            if instance_type in ["m5.large", "m5.xlarge", "t3.large", "t3.xlarge"]:
                cost = 0.0
                if instance_type == "m5.large":
                    cost = 70.08
                elif instance_type == "m5.xlarge":
                    cost = 140.16
                elif instance_type == "t3.large":
                    cost = 60.74
                elif instance_type == "t3.xlarge":
                    cost = 121.47
                
                findings.append(CostFinding(
                    user_id=user_id,
                    file_id=file_id,
                    resource_name=res_name,
                    resource_type=res_type,
                    estimated_monthly_cost=cost,
                    title="Potential Over-Provisioned Instance",
                    description="Large compute instance detected.",
                    recommendation="Verify workload requirements and consider smaller instance sizes."
                ))
                
        # 2. EBS Volumes (check if unattached)
        elif res_type == "aws_ebs_volume":
            vol_id = attrs.get("id")
            # If the volume ID (e.g. vol-xxx) or logical resource name is not referenced in any attachment
            is_attached = False
            if vol_id and str(vol_id) in attached_volume_refs:
                is_attached = True
            elif res_name in attached_volume_refs:
                is_attached = True
                
            if not is_attached:
                # Calculate cost based on size
                size = attrs.get("size") or attrs.get("volume_size")
                try:
                    size_gb = float(size) if size is not None else 80.0
                except (ValueError, TypeError):
                    size_gb = 80.0
                    
                cost = size_gb * 0.10  # $0.10 per GB-month
                
                findings.append(CostFinding(
                    user_id=user_id,
                    file_id=file_id,
                    resource_name=res_name,
                    resource_type=res_type,
                    estimated_monthly_cost=cost,
                    title="Unused Storage Volume",
                    description="Volume appears unattached.",
                    recommendation="Delete or attach volume."
                ))
                
        # 3. Public Elastic IP
        elif res_type == "aws_eip":
            findings.append(CostFinding(
                user_id=user_id,
                file_id=file_id,
                resource_name=res_name,
                resource_type=res_type,
                estimated_monthly_cost=3.65, # $0.005/hr * 730 hrs
                title="Elastic IP Allocation",
                description="Elastic IP detected.",
                recommendation="Verify active usage."
            ))
            
        # 4. Large RDS Databases
        elif res_type == "aws_db_instance":
            instance_class = attrs.get("instance_class", "")
            if isinstance(instance_class, str) and (
                instance_class in ["db.t3.large", "db.m5.large"] or 
                ("large" in instance_class and not any(x in instance_class for x in ["micro", "small", "medium"]))
            ):
                cost = 130.00
                if instance_class == "db.t3.large":
                    cost = 100.00
                elif instance_class == "db.m5.large":
                    cost = 130.00
                elif "xlarge" in instance_class:
                    cost = 260.00
                    
                findings.append(CostFinding(
                    user_id=user_id,
                    file_id=file_id,
                    resource_name=res_name,
                    resource_type=res_type,
                    estimated_monthly_cost=cost,
                    title="Large Database Instance",
                    description="Potential over-sized database.",
                    recommendation="Review utilization."
                ))

        # 5. Redundant Security Groups Preparation
        elif res_type == "aws_security_group":
            ingress_rules = attrs.get("ingress", [])
            if isinstance(ingress_rules, dict):
                ingress_rules = [ingress_rules]
            elif not isinstance(ingress_rules, list):
                ingress_rules = []
                
            # Normalize ingress rules for hash comparison
            normalized_rules = []
            for rule in ingress_rules:
                if not isinstance(rule, dict):
                    continue
                # Extract key matching fields
                rule_key = {
                    "from_port": rule.get("from_port"),
                    "to_port": rule.get("to_port"),
                    "protocol": rule.get("protocol", "tcp"),
                    "cidr_blocks": sorted(rule.get("cidr_blocks", [])) if isinstance(rule.get("cidr_blocks"), list) else [],
                    "ipv6_cidr_blocks": sorted(rule.get("ipv6_cidr_blocks", [])) if isinstance(rule.get("ipv6_cidr_blocks"), list) else []
                }
                normalized_rules.append(rule_key)
                
            # Sort normalized rules to ensure order-independence
            normalized_rules.sort(key=lambda r: (r["from_port"] or 0, r["to_port"] or 0, r["protocol"]))
            
            # Convert to a stable JSON string hash representation
            canonical_str = json.dumps(normalized_rules, sort_keys=True)
            if canonical_str not in sg_rules_map:
                sg_rules_map[canonical_str] = []
            sg_rules_map[canonical_str].append(resource)

    # Evaluate Duplicate Security Groups
    for canonical_str, groups in sg_rules_map.items():
        if len(groups) > 1:
            # All groups sharing this ruleset are redundant/duplicates of each other
            for sg_resource in groups:
                findings.append(CostFinding(
                    user_id=user_id,
                    file_id=file_id,
                    resource_name=sg_resource.resource_name,
                    resource_type="aws_security_group",
                    estimated_monthly_cost=0.00,
                    title="Redundant Security Group",
                    description="Multiple identical security groups detected.",
                    recommendation="Consolidate resources."
                ))

    # Commit findings to database
    if findings:
        db.add_all(findings)
        db.commit()
        logger.info(f"Registered {len(findings)} cost optimization findings for file #{file_id}")
        
    return findings
