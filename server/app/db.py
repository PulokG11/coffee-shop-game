"""Neon Postgres access (psycopg3): pooled connections for queries, a direct one for LISTEN."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import psycopg
import psycopg_pool

_pool: psycopg_pool.AsyncConnectionPool | None = None


def _dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL env var is not set")
    return url


def direct_dsn() -> str:
    # LISTEN does not work through Neon's transaction-mode pooler, so use the direct host.
    return os.environ.get("DATABASE_URL_DIRECT") or _dsn().replace("-pooler.", ".")


async def init_pool() -> None:
    global _pool
    _pool = psycopg_pool.AsyncConnectionPool(conninfo=_dsn(), min_size=1, max_size=10, open=False)
    await _pool.open()


async def close_pool() -> None:
    if _pool:
        await _pool.close()


@asynccontextmanager
async def get_conn() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() first")
    async with _pool.connection() as conn:
        yield conn
