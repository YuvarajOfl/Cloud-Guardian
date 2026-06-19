from pydantic import BaseModel
from datetime import datetime
from typing import Dict, Any

class AIInsightResponse(BaseModel):
    id: int
    finding_id: int
    finding_type: str
    prompt: str
    response: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class AIFollowUpRequest(BaseModel):
    finding_id: Any
    resource: str
    severity: str
    question: str
    simulate_error: str = None


class AIFollowUpResponse(BaseModel):
    answer: str
    source: str
    mode: str

