"""
backend/routers/notifications.py
In-app clinical and screening notification management endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db
from backend.models import Notification, User
from backend.schemas import NotificationResponse
from backend.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(desc(Notification.created_at)).limit(limit).all()
    return notifications


@router.post("/{id}/read", response_model=NotificationResponse)
def mark_notification_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    updated = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok", "marked_read_count": updated}
