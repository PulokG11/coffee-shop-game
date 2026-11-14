from fastapi import APIRouter, HTTPException
from app.schemas.round import OptimizeRequest, OptimizeResponse, DrinkDecision
from app.optimizer.linear import solve_rounds_1_4
from app.optimizer.nonlinear import solve_rounds_5_8
from app.routers.scenarios import get_scenario_params

router = APIRouter()


@router.post("", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest) -> OptimizeResponse:
    params = get_scenario_params(req.scenario_id, req.round_number)
    if params is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if req.round_number <= 4:
        sol = solve_rounds_1_4(params)
        return OptimizeResponse(
            decision=DrinkDecision(hot_qty=sol.hot_qty, cold_qty=sol.cold_qty),
            expected_profit=sol.expected_profit,
            solve_time_ms=sol.solve_time_ms,
        )
    else:
        sol = solve_rounds_5_8(params)
        return OptimizeResponse(
            decision=DrinkDecision(
                hot_qty=sol.hot_qty,
                cold_qty=sol.cold_qty,
                markup=sol.markup,
                service_rate=sol.service_rate,
            ),
            expected_profit=sol.expected_profit,
            solve_time_ms=sol.solve_time_ms,
        )
