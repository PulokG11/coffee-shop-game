"""Discrete-event simulation of one round using seeded NumPy random streams.

Common Random Numbers (CRN): caller supplies the seed so player and optimizer
face the same demand realisation.
"""

from __future__ import annotations

import numpy as np
from dataclasses import dataclass


@dataclass
class ScenarioParams:
    hot_mean: float
    cold_mean: float
    hot_cost: float
    cold_cost: float
    hot_price: float
    cold_price: float
    # Rounds 5-8 extras
    arrival_rate: float = 30.0       # customers / hour
    service_rate: float = 3.0        # customers / minute (barista capacity)
    balk_threshold: int = 5          # queue length at which 50% balk (Round 6+)
    markup_enabled: bool = False
    queue_enabled: bool = False


@dataclass
class SimResult:
    demand_hot: int
    demand_cold: int
    sold_hot: int
    sold_cold: int
    revenue: float
    cost: float
    profit: float
    queue_abandoned: int = 0


def simulate_round(
    params: ScenarioParams,
    hot_qty: int,
    cold_qty: int,
    markup: float,
    seed: int,
) -> SimResult:
    rng = np.random.default_rng(seed)

    demand_hot = int(rng.poisson(params.hot_mean))
    demand_cold = int(rng.poisson(params.cold_mean))

    abandoned = 0
    if params.queue_enabled:
        # Simple M/D/1 approximation: customers balk with probability
        # proportional to expected queue length
        expected_queue = params.arrival_rate / (params.service_rate * 60) - 1
        expected_queue = max(0.0, expected_queue)
        balk_prob = expected_queue / (expected_queue + params.balk_threshold)
        mask_hot = rng.random(demand_hot) >= balk_prob
        mask_cold = rng.random(demand_cold) >= balk_prob
        abandoned = int((~mask_hot).sum() + (~mask_cold).sum())
        demand_hot = int(mask_hot.sum())
        demand_cold = int(mask_cold.sum())

    hot_price = params.hot_price * (1 + markup) if params.markup_enabled else params.hot_price
    cold_price = params.cold_price * (1 + markup) if params.markup_enabled else params.cold_price

    sold_hot = min(hot_qty, demand_hot)
    sold_cold = min(cold_qty, demand_cold)

    revenue = sold_hot * hot_price + sold_cold * cold_price
    cost = hot_qty * params.hot_cost + cold_qty * params.cold_cost
    profit = revenue - cost

    return SimResult(
        demand_hot=demand_hot,
        demand_cold=demand_cold,
        sold_hot=sold_hot,
        sold_cold=sold_cold,
        revenue=revenue,
        cost=cost,
        profit=profit,
        queue_abandoned=abandoned,
    )
