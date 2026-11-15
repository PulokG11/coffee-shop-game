"""JWT auth endpoints backed by Neon Postgres (users table)."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from app.db import get_conn

router = APIRouter()
_bearer = HTTPBearer()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
_ALGO = "HS256"
_EXPIRE_DAYS = 30


def _make_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, _SECRET, algorithm=_ALGO)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGO])
        user_id: str = payload["sub"]
        return user_id
    except (JWTError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    return decode_token(creds.credentials)


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user_id: str
    display_name: str


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignUpRequest) -> AuthResponse:
    hashed = _pwd.hash(req.password)
    async with get_conn() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO public.users (id, email, hashed_password, display_name)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, display_name
            """,
            str(uuid.uuid4()), req.email, hashed, req.display_name,
        )
    if row is None:
        raise HTTPException(status_code=409, detail="Email already registered")
    return AuthResponse(
        access_token=_make_token(row["id"]),
        user_id=row["id"],
        display_name=row["display_name"],
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest) -> AuthResponse:
    async with get_conn() as conn:
        row = await conn.fetchrow(
            "SELECT id, hashed_password, display_name FROM public.users WHERE email = $1",
            req.email,
        )
    if row is None or not _pwd.verify(req.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return AuthResponse(
        access_token=_make_token(row["id"]),
        user_id=row["id"],
        display_name=row["display_name"],
    )
