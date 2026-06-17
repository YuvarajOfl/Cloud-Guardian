from pydantic import BaseModel
from datetime import datetime
from typing import List, Any, Optional

class TerraformResourceResponse(BaseModel):
    id: int
    file_id: int
    resource_type: str
    resource_name: str
    provider: str
    region: str
    resource_metadata: Optional[Any] = None
    status: str

    class Config:
        from_attributes = True


class SecurityFindingResponse(BaseModel):
    id: int
    user_id: int
    file_id: int
    resource_name: str
    resource_type: str
    severity: str
    title: str
    description: str
    recommendation: str
    created_at: datetime

    class Config:
        from_attributes = True


class CostFindingResponse(BaseModel):
    id: int
    user_id: int
    file_id: int
    resource_name: str
    resource_type: str
    estimated_monthly_cost: float
    title: str
    description: str
    recommendation: str
    created_at: datetime

    class Config:
        from_attributes = True


class TerraformFileResponse(BaseModel):
    id: int
    user_id: int
    file_name: str
    file_type: str
    upload_time: datetime
    status: str
    resources: List[TerraformResourceResponse] = []
    findings: List[SecurityFindingResponse] = []
    cost_findings: List[CostFindingResponse] = []

    class Config:
        from_attributes = True


