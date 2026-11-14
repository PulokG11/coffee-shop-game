from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import optimize, simulate, scenarios

app = FastAPI(title="Coffee Shop Game API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production via env var
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(simulate.router, prefix="/simulate", tags=["simulate"])
app.include_router(optimize.router, prefix="/optimize", tags=["optimize"])
app.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
