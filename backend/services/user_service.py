from sqlalchemy.orm import Session
from backend.models.user import User
from backend.schemas.user import UserCreate, UserUpdate

def get_user_by_id(db: Session, user_id: int) -> User:
    """
    Retrieves a user by their database primary key.
    """
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> User:
    """
    Retrieves a user by their email address.
    """
    return db.query(User).filter(User.email == email).first()

def get_user_by_google_id(db: Session, google_id: str) -> User:
    """
    Retrieves a user by their unique Google ID.
    """
    return db.query(User).filter(User.google_id == google_id).first()

def create_user(db: Session, user_in: UserCreate) -> User:
    """
    Creates a new user record in the database.
    """
    db_user = User(
        google_id=user_in.google_id,
        name=user_in.name,
        email=user_in.email,
        profile_picture=user_in.profile_picture
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: UserUpdate) -> User:
    """
    Updates an existing user record.
    """
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return None

    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    return db_user
