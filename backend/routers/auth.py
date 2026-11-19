"""
backend/routers/auth.py
Authentication endpoints: Registration, Login, and JWT Token issuance.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta

from backend.config import settings
from backend.database import get_db
from backend.models import User, UserRole
from backend.schemas import UserRegister, UserLogin, Token
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    log_audit_event,
    get_client_ip,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserRegister,
    request: Request,
    db: Session = Depends(get_db)
):
    # Check if email is already taken
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Hash password
    hashed_pw = get_password_hash(user_in.password)

    new_user = User(
        email=user_in.email.lower(),
        password_hash=hashed_pw,
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit log
    ip = get_client_ip(request)
    log_audit_event(
        db=db,
        action="REGISTER",
        entity="user",
        entity_id=str(new_user.id),
        user_id=new_user.id,
        ip=ip
    )

    # Generate token
    token = create_access_token(data={"sub": str(new_user.id), "role": new_user.role, "email": new_user.email})

    return Token(
        access_token=token,
        token_type="bearer",
        user_id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role
    )


@router.post("/login", response_model=Token)
def login(
    user_in: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        # Failed login attempt
        ip = get_client_ip(request)
        log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            entity="user",
            entity_id=user_in.email.lower(),
            user_id=None,
            ip=ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been disabled.")

    # Successful login audit log
    ip = get_client_ip(request)
    log_audit_event(
        db=db,
        action="LOGIN",
        entity="user",
        entity_id=str(user.id),
        user_id=user.id,
        ip=ip
    )

    token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})

    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role
    )
