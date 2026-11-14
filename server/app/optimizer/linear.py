"""Rounds 1-4 optimizer: LP via HiGHS (highspy).

Uses a piecewise-linear approximation of E[(Q-D)^+] to convert the
stochastic newsvendor into a deterministic LP.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import highspy
import numpy as np
from scipy.stats import norm

from app.simulation.des import ScenarioParams


@dataclass
class LinearSolution:
    hot_qty: int
    cold_qty: int
    expected_profit: float
    solve_time_ms: float


_PWL_POINTS = 20  # grid resolution for piecewise-linear approximation


def _pwl_expected_unsold(mean: float, std: float, q_max: int) -> tuple[list[float], list[float]]:
    """Return (xs, ys) for E[(Q-D)^+] approximated over [0, q_max]."""
    xs = np.linspace(0, q_max, _PWL_POINTS).tolist()
    ys = [float(norm.expect(lambda d: max(x - d, 0), loc=mean, scale=std)) for x in xs]
    return xs, ys


def solve_rounds_1_4(params: ScenarioParams, q_max: int = 200) -> LinearSolution:
    t0 = time.perf_counter()
    std_hot = params.hot_mean ** 0.5   # Poisson: var = mean
    std_cold = params.cold_mean ** 0.5

    xs_h, ys_h = _pwl_expected_unsold(params.hot_mean, std_hot, q_max)
    xs_c, ys_c = _pwl_expected_unsold(params.cold_mean, std_cold, q_max)

    h = highspy.Highs()
    h.silent()

    # Variables: Q_h, Q_c, g_h (expected unsold hot), g_c (expected unsold cold)
    # Objective: maximise  price_h*(Q_h - g_h) - cost_h*Q_h
    #                     + price_c*(Q_c - g_c) - cost_c*Q_c
    # = (price_h - cost_h)*Q_h - price_h*g_h
    # + (price_c - cost_c)*Q_c - price_c*g_c

    # HiGHS minimises, so negate
    q_h = h.addVar(0.0, q_max)
    q_c = h.addVar(0.0, q_max)
    g_h = h.addVar(0.0, q_max)
    g_c = h.addVar(0.0, q_max)

    h.changeColCost(q_h, -(params.hot_price - params.hot_cost))
    h.changeColCost(q_c, -(params.cold_price - params.cold_cost))
    h.changeColCost(g_h, params.hot_price)
    h.changeColCost(g_c, params.cold_price)

    # PWL constraints via auxiliary variables are complex in HiGHS LP;
    # instead add the convex envelope as linear cuts:
    # g >= ys[i] + (ys[i+1]-ys[i])/(xs[i+1]-xs[i]) * (Q - xs[i])  for each segment
    for i in range(len(xs_h) - 1):
        dx = xs_h[i + 1] - xs_h[i]
        if dx == 0:
            continue
        slope = (ys_h[i + 1] - ys_h[i]) / dx
        intercept = ys_h[i] - slope * xs_h[i]
        # g_h >= slope*q_h + intercept  =>  g_h - slope*q_h >= intercept
        h.addRow(intercept, 1e30, [g_h, q_h], [1.0, -slope])

    for i in range(len(xs_c) - 1):
        dx = xs_c[i + 1] - xs_c[i]
        if dx == 0:
            continue
        slope = (ys_c[i + 1] - ys_c[i]) / dx
        intercept = ys_c[i] - slope * xs_c[i]
        h.addRow(intercept, 1e30, [g_c, q_c], [1.0, -slope])

    h.run()
    info = h.getInfoValue("primal_solution_status")
    # info is (status_code, value) tuple in highspy
    sol = h.getSolution()
    col_vals = sol.col_value

    q_h_val = int(round(col_vals[q_h]))
    q_c_val = int(round(col_vals[q_c]))

    # Compute actual expected profit at the rounded integer solution
    g_h_exact = float(norm.expect(lambda d: max(q_h_val - d, 0),
                                   loc=params.hot_mean, scale=std_hot))
    g_c_exact = float(norm.expect(lambda d: max(q_c_val - d, 0),
                                   loc=params.cold_mean, scale=std_cold))
    exp_profit = (
        (params.hot_price - params.hot_cost) * q_h_val - params.hot_price * g_h_exact
        + (params.cold_price - params.cold_cost) * q_c_val - params.cold_price * g_c_exact
    )

    return LinearSolution(
        hot_qty=max(0, min(q_h_val, q_max)),
        cold_qty=max(0, min(q_c_val, q_max)),
        expected_profit=exp_profit,
        solve_time_ms=(time.perf_counter() - t0) * 1000,
    )
