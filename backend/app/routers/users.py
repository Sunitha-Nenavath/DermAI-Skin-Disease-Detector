"""
DermAI Backend — Users Router
GET  /users/me      — current user profile
PUT  /users/me      — update name / password
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password
from app.models.models import User
from app.schemas.schemas import UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse, summary="Update current user profile")
async def update_me(
    body: UserUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.password is not None:
        current_user.password_hash = hash_password(body.password)
    db.add(current_user)
    return UserResponse.model_validate(current_user)
