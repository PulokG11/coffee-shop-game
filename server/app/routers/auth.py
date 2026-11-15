"""JWT auth endpoints backed by Neon Postgres (public.users)."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from psycopg.rows import dict_row
from pydantic import BaseModel, EmailStr, Field

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
        return str(payload["sub"])
    except (JWTError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    return decode_token(creds.credentials)


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=40)


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
    async with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            INSERT INTO public.users (email, hashed_password, display_name)
            VALUES (%s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, display_name
            """,
            (req.email, hashed, req.display_name),
        )
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=409, detail="Email already registered")
    user_id = str(row["id"])
    return AuthResponse(
        access_token=_make_token(user_id), user_id=user_id, display_name=row["display_name"]
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest) -> AuthResponse:
    async with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            "SELECT id, hashed_password, display_name FROM public.users WHERE email = %s",
            (req.email,),
        )
        row = await cur.fetchone()
    if row is None or not _pwd.verify(req.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user_id = str(row["id"])
    return AuthResponse(
        access_token=_make_token(user_id), user_id=user_id, display_name=row["display_name"]
    )
