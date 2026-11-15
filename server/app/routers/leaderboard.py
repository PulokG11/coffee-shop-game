"""Leaderboard endpoints: REST fetch + SSE stream (backed by Neon LISTEN/NOTIFY)."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.db import get_conn

router = APIRouter()


@router.get("")
async def get_leaderboard(
    class_id: str = Query(...),
    scenario_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict]:
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT display_name, total_profit, rounds_played, snapshot_at
            FROM public.leaderboard
            WHERE class_id = $1 AND scenario_id = $2
            ORDER BY total_profit DESC
            LIMIT $3
            """,
            class_id, scenario_id, limit,
        )
    return [dict(r) for r in rows]


@router.get("/stream")
async def stream_leaderboard(
    class_id: str = Query(...),
    scenario_id: str = Query(...),
) -> StreamingResponse:
    """Server-Sent Events stream: pushes updated leaderboard on NOTIFY events."""

    async def event_generator():
        channel = f"leaderboard_{class_id}"
        async with get_conn() as conn:
            await conn.execute(f"LISTEN {channel}")  # noqa: S608 — channel is server-controlled
            try:
                while True:
                    # Wait up to 5 s for a notification, then send a keepalive
                    notif = await asyncio.wait_for(
                        conn.notifies().__anext__(),
                        timeout=5.0,
                    )
                    # notif.payload contains the new leaderboard row JSON
                    rows = await _fetch_rows(conn, class_id, scenario_id)
                    yield f"data: {json.dumps(rows)}\n\n"
            except (asyncio.TimeoutError, StopAsyncIteration):
                yield ": keepalive\n\n"
            except GeneratorExit:
                pass
            finally:
                await conn.execute(f"UNLISTEN {channel}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


async def _fetch_rows(conn, class_id: str, scenario_id: str) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT display_name, total_profit, rounds_played,
               to_char(snapshot_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS snapshot_at
        FROM public.leaderboard
        WHERE class_id = $1 AND scenario_id = $2
        ORDER BY total_profit DESC LIMIT 50
        """,
        class_id, scenario_id,
    )
    return [dict(r) for r in rows]
