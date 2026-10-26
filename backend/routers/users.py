"""
backend/routers/users.py
User profile management and administrator audit trails.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db
from backend.models import User, AuditLog, UserRole
from backend.schemas import UserResponse, UserUpdate, AuditLogResponse
from backend.auth import get_current_user, require_role, log_audit_event, get_client_ip

router = APIRouter(tags=["Users"])


@router.get("/users/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/users/me", response_model=UserResponse)
def update_current_user_profile(
    user_update: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.email is not None and user_update.email.lower() != current_user.email:
        # Check collision
        collision = db.query(User).filter(User.email == user_update.email.lower(), User.id != current_user.id).first()
        if collision:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already in use by another user.")
        current_user.email = user_update.email.lower()

    db.commit()
    db.refresh(current_user)

    ip = get_client_ip(request)
    log_audit_event(db=db, action="PROFILE_UPDATE", entity="user", entity_id=str(current_user.id), user_id=current_user.id, ip=ip)

    return current_user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    db: Session = Depends(get_db)
):
    return db.query(User).offset(skip).limit(limit).all()


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    limit: int = 100,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    db: Session = Depends(get_db)
):
    return db.query(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit).all()
