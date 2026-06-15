from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr

class UserBase(BaseModel):
    email: EmailStr
    name: str
    profile_picture: Optional[str] = None

class UserCreate(UserBase):
    google_id: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    profile_picture: Optional[str] = None

class UserResponse(UserBase):
    id: int
    google_id: str
    created_at: datetime
    updated_at: datetime

    # Pydantic v2 configuration to allow serialization from SQLAlchemy models
    model_config = ConfigDict(from_attributes=True)
