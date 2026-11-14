from pydantic import BaseModel, Field


class DrinkDecision(BaseModel):
    hot_qty: int = Field(ge=0, le=200)
    cold_qty: int = Field(ge=0, le=200)
    markup: float = Field(ge=0.0, le=2.0, default=0.0)
    service_rate: float = Field(ge=1.0, le=10.0, default=3.0)


class SimulateRequest(BaseModel):
    round_number: int = Field(ge=1, le=8)
    scenario_id: str
    decision: DrinkDecision
    seed: int


class SimulateResponse(BaseModel):
    demand_hot: int
    demand_cold: int
    sold_hot: int
    sold_cold: int
    revenue: float
    cost: float
    profit: float
    queue_abandoned: int = 0


class OptimizeRequest(BaseModel):
    round_number: int = Field(ge=1, le=8)
    scenario_id: str
    seed: int


class OptimizeResponse(BaseModel):
    decision: DrinkDecision
    expected_profit: float
    solve_time_ms: float
