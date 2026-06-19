import json
import logging
import re
import requests
import google.generativeai as genai
from backend.config.settings import settings

logger = logging.getLogger("backend.services.gemini")

api_key = settings.GEMINI_API_KEY
if api_key and "your_gemini_api_key_here" not in api_key.lower():
    logger.info("[OK] Gemini API Key Loaded")
    genai.configure(api_key=api_key)
else:
    logger.error("[ERROR] Gemini API Key Missing")

# Standardized prompt for Security Findings
SECURITY_PROMPT_TEMPLATE = """
You are a Cloud Security Architect. Analyze the following security finding discovered in a Terraform state file:

Resource Name: {resource_name}
Resource Type: {resource_type}
Severity: {severity}
Finding Title: {title}
Description: {description}
Recommendation: {recommendation}

Please provide remediation guidance. You MUST respond with a single JSON object. Do not include any other text, markdown blocks, or commentary. Use this exact JSON structure:
{{
  "issue_summary": "A human-readable summary of the issue.",
  "why_this_matters": "A technical explanation of the vulnerability and attack surface.",
  "business_impact": "The impact of this security issue on business operations, compliance, and reputation.",
  "recommended_fix": "Recommended step-by-step actions to resolve this security issue.",
  "terraform_example": "A valid Terraform HCL snippet demonstrating how to fix the resource configuration.",
  "best_practice": "Best-practice guidance to prevent this issue in the future."
}}
"""

# Standardized prompt for Cost Findings
COST_PROMPT_TEMPLATE = """
You are a Cloud Cost Optimization Specialist. Analyze the following cost optimization finding discovered in a Terraform state file:

Resource Name: {resource_name}
Resource Type: {resource_type}
Finding Title: {title}
Description: {description}
Estimated Monthly Cost Waste: ${estimated_monthly_cost:.2f}
Recommendation: {recommendation}

Please provide optimization guidance. You MUST respond with a single JSON object. Do not include any other text, markdown blocks, or commentary. Use this exact JSON structure:
{{
  "cost_concern": "A human-readable summary of the cost concern or waste.",
  "estimated_impact": "An explanation of the financial impact and monthly savings.",
  "optimization_suggestion": "Recommended actions or cleanup procedures to optimize this cost.",
  "alternative_resource_recommendation": "Terraform code suggestion or alternative resource tier/type to use.",
  "best_practice": "Best-practice guidance for ongoing cost management of this resource type."
}}
"""

def generate_mock_security_response(finding) -> dict:
    """
    Generates a realistic mock security insight response for testing and fallback.
    """
    resource_name = finding.resource_name
    resource_type = finding.resource_type
    title = finding.title

    tf_snippet = ""
    if "s3" in resource_type.lower() or "s3" in title.lower():
        tf_snippet = """resource "aws_s3_bucket_public_access_block" "remediation" {
  bucket = aws_s3_bucket.example.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}"""
    elif "port" in title.lower() or "ssh" in title.lower() or "security_group" in resource_type.lower():
        tf_snippet = """resource "aws_security_group_rule" "remediation" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/16"] # Restrict to internal CIDR
  security_group_id = aws_security_group.allow_ssh.id
}"""
    else:
        tf_snippet = f"""# Remediation for {resource_type}
resource "{resource_type}" "{resource_name.split('.')[-1] if '.' in resource_name else 'remediation'}" {{
  # Ensure secure configurations are enforced
  # Check encryption, logging, and access control settings
}}"""

    return {
        "issue_summary": f"The resource '{resource_name}' has been flagged with a {finding.severity} severity risk: '{title}'.",
        "why_this_matters": f"Exposing configurations in {resource_type} without proper restrictions increases the attack surface, allowing unauthorized actors to perform malicious actions or read credentials.",
        "business_impact": "Compromised infrastructure can lead to data breaches, regulatory penalties (e.g., GDPR, HIPAA), loss of customer trust, and unexpected service downtime.",
        "recommended_fix": f"Follow best practices to restrict resource visibility. {finding.recommendation}",
        "terraform_example": tf_snippet,
        "best_practice": f"Enforce least-privilege policies, automate security scanning in the CI/CD pipeline, and audit network access rules regularly for all {resource_type} resources."
    }

def generate_mock_cost_response(finding) -> dict:
    """
    Generates a realistic mock cost insight response for testing and fallback.
    """
    resource_name = finding.resource_name
    resource_type = finding.resource_type
    title = finding.title
    cost = finding.estimated_monthly_cost

    tf_snippet = ""
    if "ec2" in resource_type.lower() or "instance" in resource_type.lower():
        tf_snippet = """resource "aws_instance" "optimized" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro" # Downgraded from large tier for cost optimization
  
  tags = {
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}"""
    elif "ebs" in resource_type.lower() or "volume" in resource_type.lower():
        tf_snippet = """# EBS Volume Cleanup
# Identify unused EBS volumes and delete them if unattached for > 30 days.
# Ensure a snapshot is taken before deletion.
# terraform destroy -target=aws_ebs_volume.unused_volume"""
    else:
        tf_snippet = f"""# Cost Optimization for {resource_type}
# Review the sizing and utilization of this resource: {resource_name}
# Potential savings of ${cost:.2f}/mo"""

    return {
        "cost_concern": f"Resource '{resource_name}' ({resource_type}) is flagged under '{title}' causing cost inefficiencies.",
        "estimated_impact": f"This resource incurs unnecessary charges, estimating a monthly savings of ${cost:.2f} (${cost * 12:.2f} annually) if remediated.",
        "optimization_suggestion": f"Analyze resource utilization metrics. {finding.recommendation}",
        "alternative_resource_recommendation": tf_snippet,
        "best_practice": f"Adopt auto-scaling rules, schedule shut-down policies for non-production environments, and conduct monthly review of idle resources."
    }

def clean_and_parse_json(text: str) -> dict:
    """
    Utility to extract and parse JSON from LLM response text which might be wrapped in markdown blocks.
    """
    # Try direct parse
    try:
        return json.loads(text.strip())
    except Exception:
        pass

    # Extract JSON content from markdown block ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        json_content = match.group(1).strip()
        try:
            return json.loads(json_content)
        except Exception:
            pass

    # Find the first '{' and last '}'
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        json_content = text[start:end+1].strip()
        try:
            return json.loads(json_content)
        except Exception:
            pass

    raise ValueError("Response is not valid JSON")

def analyze_finding(finding, finding_type: str, simulate_error: str = None) -> dict:
    """
    Calls Google Gemini API to analyze a finding (either security or cost) and returns a structured JSON recommendation.
    If the API key is missing or the request fails, falls back to realistic mock recommendations.
    """
    api_key = settings.GEMINI_API_KEY
    if simulate_error == "invalid_key":
        api_key = "invalid_simulated_api_key_value"
        logger.info("[Simulation] Simulating invalid Gemini API Key.")
        genai.configure(api_key=api_key)
    
    # Check if API key exists
    if not api_key or "your_gemini_api_key_here" in api_key.lower():
        logger.warning("GEMINI_API_KEY is not configured. Falling back to mock AI analysis.")
        if finding_type == "security":
            return generate_mock_security_response(finding)
        else:
            return generate_mock_cost_response(finding)

    # Prepare prompt
    if finding_type == "security":
        prompt = SECURITY_PROMPT_TEMPLATE.format(
            resource_name=finding.resource_name,
            resource_type=finding.resource_type,
            severity=finding.severity,
            title=finding.title,
            description=finding.description,
            recommendation=finding.recommendation
        )
    elif finding_type == "cost":
        prompt = COST_PROMPT_TEMPLATE.format(
            resource_name=finding.resource_name,
            resource_type=finding.resource_type,
            title=finding.title,
            description=finding.description,
            estimated_monthly_cost=finding.estimated_monthly_cost,
            recommendation=finding.recommendation
        )
    else:
        raise ValueError(f"Invalid finding type: {finding_type}")

    model_name = "gemini-2.5-flash"

    try:
        if simulate_error == "timeout":
            logger.info("[Simulation] Simulating Gemini connection timeout.")
            raise Exception("Simulated connection timeout")
        elif simulate_error == "quota":
            logger.info("[Simulation] Simulating Gemini quota exceeded (429).")
            raise Exception("Gemini API returned status code 429: Quota exceeded")
        
        logger.info(f"Sending analysis request to Gemini for {finding_type} finding ID: {finding.id}...")
        
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )
        
        text_response = response.text
        if not text_response:
            logger.error("Empty response text returned from Gemini API. Using mock fallback.")
            if finding_type == "security":
                return generate_mock_security_response(finding)
            else:
                return generate_mock_cost_response(finding)

        parsed_response = clean_and_parse_json(text_response)
        logger.info("Successfully received and parsed Gemini AI response.")
        return parsed_response

    except Exception as exc:
        logger.error(f"[Gemini Error]\n{exc}")
        if finding_type == "security":
            return generate_mock_security_response(finding)
        else:
            return generate_mock_cost_response(finding)
    finally:
        if simulate_error == "invalid_key":
            genai.configure(api_key=settings.GEMINI_API_KEY)


FOLLOW_UP_PROMPT_TEMPLATE = """
You are a Cloud Security Architect. A user has a follow-up question about a security finding in their Terraform configuration.

Here is the context of the security finding:
Resource: {resource}
Severity: {severity}
Vulnerability Title: {title}
Vulnerability Description: {description}
Remediation Recommendation: {recommendation}

User Question: {question}

Please provide a clear, concise, and professional answer to the user's question, focusing specifically on cloud security best practices and Terraform HCL remediation. Do not wrap the output in JSON; just return the text response (Markdown is allowed).
"""

GENERAL_PROMPT_TEMPLATE = """
You are a helpful and knowledgeable AI assistant. Please provide a clear, concise, and professional answer to the user's question. Do not wrap the output in JSON; just return the text response (Markdown is allowed).

User Question: {question}
"""

def check_context_needed(question: str, finding) -> bool:
    q_lower = question.lower()
    keywords = [
        "finding", "vulnerability", "risk", "remediation", 
        "terraform", "security group", "security_group", "iam", "s3",
        "danger", "dangerous", "threat", "impact", "fix"
    ]
    if any(kw in q_lower for kw in keywords):
        return True
    if finding and finding.resource_name:
        res_name_lower = finding.resource_name.lower()
        if res_name_lower in q_lower:
            return True
        # Also check components if dot-separated
        parts = res_name_lower.split('.')
        for part in parts:
            if len(part) > 2 and part in q_lower:
                return True
    return False

CURATED_REMEDIATION_TEMPLATES = {
    "ssh open to world": {
        "risk": "SSH port (22) is open to the public internet (0.0.0.0/0). This allows anyone from any location to attempt brute-force authentication or exploit SSH service vulnerabilities.",
        "impact": "Potential unauthorized command-line access to the host instance, leading to server compromise, credential theft, and lateral movement within the cloud environment.",
        "best_practice": "Restrict SSH access to specific trusted management IP ranges (e.g., your corporate IP range) or use AWS Systems Manager Session Manager to completely disable inbound SSH ports.",
        "terraform_fix": """resource "aws_security_group_rule" "allow_ssh_trusted" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/16"] # REPLACE: Use your corporate office or VPN IP range
  security_group_id = aws_security_group.main.id
}"""
    },
    "rdp open to world": {
        "risk": "RDP port (3389) is open to the public internet (0.0.0.0/0). This exposes Windows remote desktop capabilities to brute-force attacks and protocol exploits.",
        "impact": "Unauthorized administrative control of Windows Server instances, potential deployment of ransomware, or access to sensitive local credentials.",
        "best_practice": "Restrict RDP access to specific administrative CIDR blocks, or connect securely via a VPN gateway or bastion host.",
        "terraform_fix": """resource "aws_security_group_rule" "allow_rdp_trusted" {
  type              = "ingress"
  from_port         = 3389
  to_port           = 3389
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/16"] # REPLACE: Use your VPN or administrative CIDR block
  security_group_id = aws_security_group.main.id
}"""
    },
    "all ports open to world": {
        "risk": "The security group allows all ports (0-65535) and protocols from any source (0.0.0.0/0). This is equivalent to having no firewall.",
        "impact": "Exposes all services, applications, and internal ports running on the instance to direct exploitation by internet attackers.",
        "best_practice": "Follow the principle of least privilege. Explicitly allow only required inbound TCP/UDP ports from specific verified source ranges.",
        "terraform_fix": """resource "aws_security_group_rule" "allow_http_only" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"] # Open only SSL to public
  security_group_id = aws_security_group.main.id
}"""
    },
    "s3 bucket publicly accessible": {
        "risk": "The S3 bucket ACL is configured to allow public-read or public-read-write access. This allows any internet user to read, list, or write objects to this bucket.",
        "impact": "Data leak of sensitive corporate documents or proprietary datasets, and potential unauthorized storage cost exploitation if write permissions are public.",
        "best_practice": "Enable AWS S3 Block Public Access settings at the bucket and account level. Use CloudFront with Origin Access Identity (OAI) for public asset delivery.",
        "terraform_fix": """resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}"""
    },
    "s3 bucket server-side encryption disabled": {
        "risk": "Default server-side encryption is not enabled. Files stored in this bucket are not automatically encrypted at rest.",
        "impact": "Non-compliance with regulatory frameworks (e.g., HIPAA, PCI-DSS) and increased risk of data exposure if the physical underlying storage medium is compromised.",
        "best_practice": "Configure S3 bucket default encryption using AES256 (SSE-S3) or an AWS KMS key (SSE-KMS).",
        "terraform_fix": """resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}"""
    },
    "rds database publicly accessible": {
        "risk": "RDS DB instance is configured with 'publicly_accessible = true', assigning it a public IP address reachable over the internet.",
        "impact": "Exposes database listener ports (e.g. 3306, 5432) to remote database brute force attacks, credential scanning, and potential SQL exploits.",
        "best_practice": "Ensure databases are created in private VPC subnets. Connect using database proxies, bastion hosts, or site-to-site VPNs.",
        "terraform_fix": """resource "aws_db_instance" "secure_db" {
  # ... other config
  publicly_accessible = false
  db_subnet_group_name = aws_db_subnet_group.private.name
}"""
    },
    "rds storage encryption disabled": {
        "risk": "RDS instance storage is not encrypted at rest. Backups, read replicas, and database volumes are stored unencrypted.",
        "impact": "Exposure of database records in backups or snapshots, and violation of regulatory compliance requirements regarding sensitive personal data storage.",
        "best_practice": "Set 'storage_encrypted = true' and specify an KMS key ID for database creation.",
        "terraform_fix": """resource "aws_db_instance" "secure_db" {
  # ... other config
  storage_encrypted = true
  # kms_key_id      = "arn:aws:kms:region:account:key/key-id"
}"""
    },
    "iam policy grants wildcard admin privileges": {
        "risk": "The IAM policy has a statement with Action '*' on Resource '*'. This allows full administrator rights to the entity assuming this role.",
        "impact": "Extreme privilege escalation risk. If the assuming entity (e.g. EC2 instance, Lambda) is compromised, the attacker gains full control over the AWS account.",
        "best_practice": "Restrict Action permissions to only the minimum required API calls and specify exact ARNs in Resource blocks.",
        "terraform_fix": """resource "aws_iam_policy" "least_privilege" {
  name        = "least_privilege_policy"
  description = "Allows specific read/write operations on targeted S3 resources"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:s3:::my-secure-bucket/*"
      }
    ]
  })
}"""
    }
}

def get_generic_fallback_template(finding) -> dict:
    risk = finding.description
    impact = f"Compromising {finding.resource_name} ({finding.resource_type}) could lead to service exposure, non-compliance, and operational disruption."
    best_practice = f"Enforce secure defaults for {finding.resource_type} resources. Regularly scan configuration states and run automated validation checks."
    terraform_fix = f"""# Recommended configuration fix for {finding.resource_type}
resource "{finding.resource_type}" "remediated" {{
  # Remediate: {finding.title}
  # Recommended action: {finding.recommendation}
}}"""
    return {
        "risk": risk,
        "impact": impact,
        "best_practice": best_practice,
        "terraform_fix": terraform_fix
    }

def get_fallback_answer_for_question(finding, question: str) -> str:
    if not check_context_needed(question, finding):
        return "I'm sorry, I'm currently unable to access the live Gemini AI service to answer your general question. Please check your connection, API configuration, or ask a question related to the security finding to use the offline knowledge base."

    title_lower = finding.title.lower()
    res_type_lower = finding.resource_type.lower()
    
    template = None
    if "ssh" in title_lower or "port 22" in title_lower:
        template = CURATED_REMEDIATION_TEMPLATES["ssh open to world"]
    elif "rdp" in title_lower or "port 3389" in title_lower:
        template = CURATED_REMEDIATION_TEMPLATES["rdp open to world"]
    elif "all ports" in title_lower:
        template = CURATED_REMEDIATION_TEMPLATES["all ports open to world"]
    elif "s3" in res_type_lower or "s3" in title_lower:
        if "encryption" in title_lower:
            template = CURATED_REMEDIATION_TEMPLATES["s3 bucket server-side encryption disabled"]
        else:
            template = CURATED_REMEDIATION_TEMPLATES["s3 bucket publicly accessible"]
    elif "db" in res_type_lower or "rds" in title_lower:
        if "encryption" in title_lower:
            template = CURATED_REMEDIATION_TEMPLATES["rds storage encryption disabled"]
        else:
            template = CURATED_REMEDIATION_TEMPLATES["rds database publicly accessible"]
    elif "iam" in res_type_lower or "iam" in title_lower:
        template = CURATED_REMEDIATION_TEMPLATES["iam policy grants wildcard admin privileges"]
        
    if not template:
        template = get_generic_fallback_template(finding)
        
    question_lower = question.lower()
    
    if any(k in question_lower for k in ["dangerous", "why", "risk", "security", "threat"]):
        answer = f"### Risk Analysis\n{template['risk']}\n\n### Potential Impact\n{template['impact']}"
    elif any(k in question_lower for k in ["fix", "remediate", "code", "terraform", "example"]):
        answer = f"### Terraform HCL Fix Example\n```hcl\n{template['terraform_fix']}\n```"
    elif any(k in question_lower for k in ["junior", "explain", "simple"]):
        answer = f"### Simple Explanation (Junior Friendly)\nThis configuration is unsecured. The risk is: {template['risk']}\n\nThe potential impact is: {template['impact']}\n\nTo fix it, we should follow this best practice: {template['best_practice']}."
    elif any(k in question_lower for k in ["practice", "practices", "standard", "prevent"]):
        answer = f"### Best Practice Guidelines\n{template['best_practice']}"
    elif any(k in question_lower for k in ["impact", "business", "cost", "financial"]):
        answer = f"### Business & Compliance Impact\n{template['impact']}"
    elif any(k in question_lower for k in ["auditor", "compliance", "audit", "governance"]):
        answer = f"### Compliance Audit Perspective\nAn auditor would flag this configuration as a key risk. Security policy requires that default settings conform to the CIS AWS Foundations Benchmark. Specifically:\n{template['best_practice']}\n\n*Security Control Risk:* {template['risk']}"
    else:
        answer = f"""### Expert Remediation Guidance

**Vulnerability Risk:**
{template['risk']}

**Business Impact:**
{template['impact']}

**Best Practices:**
{template['best_practice']}

**Remediation Fix:**
```hcl
{template['terraform_fix']}
```"""
    
    return answer

def ask_gemini_follow_up(finding, question: str, simulate_error: str = None) -> str:
    api_key = settings.GEMINI_API_KEY
    if simulate_error == "invalid_key":
        api_key = "invalid_simulated_api_key_value"
        logger.info("[Simulation] Simulating invalid Gemini API Key.")
        genai.configure(api_key=api_key)
        
    if not api_key or "your_gemini_api_key_here" in api_key.lower():
        raise ValueError("GEMINI_API_KEY is not configured.")
        
    if check_context_needed(question, finding):
        prompt = FOLLOW_UP_PROMPT_TEMPLATE.format(
            resource=finding.resource_name,
            severity=finding.severity,
            title=finding.title,
            description=finding.description,
            recommendation=finding.recommendation,
            question=question
        )
    else:
        prompt = GENERAL_PROMPT_TEMPLATE.format(
            question=question
        )
    
    model_name = "gemini-2.5-flash"
    
    try:
        if simulate_error == "timeout":
            logger.info("[Simulation] Simulating Gemini connection timeout.")
            raise Exception("Simulated connection timeout")
        elif simulate_error == "quota":
            logger.info("[Simulation] Simulating Gemini quota exceeded (429).")
            raise Exception("Gemini API returned status code 429: Quota exceeded")
        
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3
            )
        )
        
        text_response = response.text
        if not text_response or not text_response.strip():
            raise Exception("Empty response returned from Gemini API.")
            
        return text_response.strip()
    except Exception as exc:
        logger.error(f"[Gemini Error]\n{exc}")
        raise exc
    finally:
        if simulate_error == "invalid_key":
            genai.configure(api_key=settings.GEMINI_API_KEY)

