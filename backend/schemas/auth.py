from pydantic import BaseModel
from backend.schemas.user import UserResponse

class GoogleLoginRequest(BaseModel):
    google_token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
