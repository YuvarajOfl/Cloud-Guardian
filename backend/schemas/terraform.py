from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class AnalysisRecordResponse(BaseModel):
    id: int
    file_id: int
    status: str
    findings_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class TerraformFileResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    original_filename: str
    file_path: str
    upload_timestamp: datetime
    status: str
    created_at: datetime
    analysis_records: List[AnalysisRecordResponse] = []

    class Config:
        from_attributes = True


class FileContentResponse(BaseModel):
    id: int
    original_filename: str
    status: str
    is_text: bool
    content: Optional[str] = None
    zip_files: Optional[List[str]] = None
