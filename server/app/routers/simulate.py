from fastapi import APIRouter, HTTPException
from app.schemas.round import SimulateRequest, SimulateResponse
from app.simulation.des import simulate_round, ScenarioParams
from app.routers.scenarios import get_scenario_params

router = APIRouter()


@router.post("", response_model=SimulateResponse)
def simulate(req: SimulateRequest) -> SimulateResponse:
    params = get_scenario_params(req.scenario_id, req.round_number)
    if params is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    result = simulate_round(
        params=params,
        hot_qty=req.decision.hot_qty,
        cold_qty=req.decision.cold_qty,
        markup=req.decision.markup,
        seed=req.seed,
    )
    return SimulateResponse(
        demand_hot=result.demand_hot,
        demand_cold=result.demand_cold,
        sold_hot=result.sold_hot,
        sold_cold=result.sold_cold,
        revenue=result.revenue,
        cost=result.cost,
        profit=result.profit,
        queue_abandoned=result.queue_abandoned,
    )
