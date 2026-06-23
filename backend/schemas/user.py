from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, field_serializer

class UserBase(BaseModel):
    email: EmailStr
    name: str
    profile_picture: Optional[str] = None
    role: Optional[str] = None
    provider: str = "local"
    is_active: Optional[bool] = True
    is_deleted: Optional[bool] = False

class UserCreate(UserBase):
    google_id: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    profile_picture: Optional[str] = None

class UserResponse(UserBase):
    id: int
    google_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_admin: bool
    access_level: str


    # Pydantic v2 configuration to allow serialization from SQLAlchemy models
    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at', 'updated_at')
    def serialize_dates(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()

