from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import close_pool, init_pool
from app.routers import auth, leaderboard, optimize, scenarios, simulate


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(title="Coffee Shop Game API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production via env var
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(simulate.router, prefix="/simulate", tags=["simulate"])
app.include_router(optimize.router, prefix="/optimize", tags=["optimize"])
app.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])
app.include_router(leaderboard.router, prefix="/leaderboard", tags=["leaderboard"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
