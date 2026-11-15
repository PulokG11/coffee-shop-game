"""Neon Postgres connection pool (psycopg3 + pgbouncer-compatible pooled URL)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import psycopg_pool
from psycopg import AsyncConnection

_pool: psycopg_pool.AsyncConnectionPool | None = None


def _dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL env var is not set")
    return url


async def init_pool() -> None:
    global _pool
    _pool = psycopg_pool.AsyncConnectionPool(
        conninfo=_dsn(),
        min_size=1,
        max_size=10,
        open=False,
    )
    await _pool.open()


async def close_pool() -> None:
    if _pool:
        await _pool.close()


@asynccontextmanager
async def get_conn() -> AsyncGenerator[AsyncConnection, None]:
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() first")
    async with _pool.connection() as conn:
        yield conn
