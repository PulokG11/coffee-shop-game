"""Leaderboard endpoints: REST fetch + SSE stream driven by Postgres LISTEN/NOTIFY."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

import psycopg
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from psycopg import sql
from psycopg.rows import dict_row

from app.db import direct_dsn, get_conn

router = APIRouter()

_SELECT = """
    SELECT display_name, total_profit::float AS total_profit, rounds_played,
           to_char(snapshot_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS snapshot_at
    FROM public.leaderboard
    WHERE class_id = %s AND scenario_id = %s
    ORDER BY total_profit DESC
    LIMIT %s
"""


async def _fetch_rows(
    conn: psycopg.AsyncConnection, class_id: str, scenario_id: str, limit: int = 50
) -> list[dict[str, Any]]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_SELECT, (class_id, scenario_id, limit))
        return await cur.fetchall()


@router.get("")
async def get_leaderboard(
    class_id: str = Query(..., max_length=64),
    scenario_id: str = Query(..., max_length=64),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict[str, Any]]:
    async with get_conn() as conn:
        return await _fetch_rows(conn, class_id, scenario_id, limit)


@router.get("/stream")
async def stream_leaderboard(
    class_id: str = Query(..., max_length=64),
    scenario_id: str = Query(..., max_length=64),
) -> StreamingResponse:
    """Server-Sent Events: sends the board on connect and again on every NOTIFY."""

    async def events() -> AsyncGenerator[str, None]:
        channel = sql.Identifier(f"leaderboard_{class_id}")
        conn = await psycopg.AsyncConnection.connect(direct_dsn(), autocommit=True)
        try:
            await conn.execute(sql.SQL("LISTEN {}").format(channel))
            yield f"data: {json.dumps(await _fetch_rows(conn, class_id, scenario_id))}\n\n"
            while True:
                notified = False
                async for _ in conn.notifies(timeout=15.0, stop_after=1):
                    notified = True
                if notified:
                    rows = await _fetch_rows(conn, class_id, scenario_id)
                    yield f"data: {json.dumps(rows)}\n\n"
                else:
                    yield ": keepalive\n\n"
        finally:
            await conn.close()

    return StreamingResponse(events(), media_type="text/event-stream")
