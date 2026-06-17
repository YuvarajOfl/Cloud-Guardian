import json
import logging
import re
import requests
from backend.config.settings import settings

logger = logging.getLogger("backend.services.gemini")

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

def analyze_finding(finding, finding_type: str) -> dict:
    """
    Calls Google Gemini API to analyze a finding (either security or cost) and returns a structured JSON recommendation.
    If the API key is missing or the request fails, falls back to realistic mock recommendations.
    """
    api_key = settings.GEMINI_API_KEY
    
    # Check if API key exists
    if not api_key:
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

    # Build Gemini request
    model_name = "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    headers = {"Content-Type": "application/json"}

    try:
        logger.info(f"Sending analysis request to Gemini for {finding_type} finding ID: {finding.id}...")
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        
        if response.status_code != 200:
            logger.error(f"Gemini API returned error code {response.status_code}: {response.text}. Using mock fallback.")
            if finding_type == "security":
                return generate_mock_security_response(finding)
            else:
                return generate_mock_cost_response(finding)

        result = response.json()
        candidates = result.get("candidates", [])
        if not candidates:
            logger.error("No candidates returned from Gemini API response. Using mock fallback.")
            if finding_type == "security":
                return generate_mock_security_response(finding)
            else:
                return generate_mock_cost_response(finding)

        text_response = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        parsed_response = clean_and_parse_json(text_response)
        logger.info("Successfully received and parsed Gemini AI response.")
        return parsed_response

    except Exception as exc:
        logger.error(f"Exception calling Gemini API: {exc}. Falling back to mock generator.")
        if finding_type == "security":
            return generate_mock_security_response(finding)
        else:
            return generate_mock_cost_response(finding)
