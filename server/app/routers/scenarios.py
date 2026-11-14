"""Scenario loader — reads versioned JSON packages from /scenarios/."""

from __future__ import annotations

import json
from pathlib import Path
from functools import lru_cache

from fastapi import APIRouter
from app.simulation.des import ScenarioParams

router = APIRouter()
_SCENARIOS_DIR = Path(__file__).parents[4] / "scenarios"


@lru_cache(maxsize=64)
def _load_scenario(scenario_id: str) -> dict | None:
    path = _SCENARIOS_DIR / f"{scenario_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def get_scenario_params(scenario_id: str, round_number: int) -> ScenarioParams | None:
    data = _load_scenario(scenario_id)
    if data is None:
        return None
    rounds: list[dict] = data.get("rounds", [])
    if round_number < 1 or round_number > len(rounds):
        return None
    r = rounds[round_number - 1]
    return ScenarioParams(
        hot_mean=r["hot_mean"],
        cold_mean=r["cold_mean"],
        hot_cost=r["hot_cost"],
        cold_cost=r["cold_cost"],
        hot_price=r["hot_price"],
        cold_price=r["cold_price"],
        arrival_rate=r.get("arrival_rate", 30.0),
        service_rate=r.get("service_rate", 3.0),
        balk_threshold=r.get("balk_threshold", 5),
        markup_enabled=r.get("markup_enabled", False),
        queue_enabled=r.get("queue_enabled", False),
    )


@router.get("")
def list_scenarios() -> list[str]:
    return [p.stem for p in _SCENARIOS_DIR.glob("*.json")]
