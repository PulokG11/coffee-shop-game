# Changelog

Every release is a git tag. To roll back, check out the previous tag (whole repo) or restore single files from it:

```bash
git checkout v0.1.0-scaffold -- src scenarios
git commit -m "rollback: client to v0.1.0-scaffold"
```

## v0.2.0-prototype — 2026-11-15

Playable single-player prototype of all eight rounds, running entirely in the browser.

- **Engine** (`src/engine/`): seeded random streams with common random numbers, a discrete-event shop simulation (hourly brewing and waste, Poisson arrivals, one barista, balking, multi-cup orders), the analytic expected-profit model (Normal newsvendor + birth–death queue), and an exact optimizer over the slider grid.
- **Scenario** `scenarios/default_v2.json`: eight rounds following the Product Guide (hot only → hot and cold → hot cost → both costs → markup → balking → bigger orders → barista skill). Numbers are our own design.
- **Game UI**: animated shop with BrewBot stock tanks, slider panel with numeric inputs and feasibility, Constraint Monitor (meters + feasible region), Profit Monitor (expected-profit curve per decision), live stats, speed control, round intros and contextual tips from the guide character Crema, comparison screen (settings, metrics, outcome spread over 150 replayed weeks), final summary. Progress is saved in the browser.
- **Tests** (`npm test`): reproducibility, common random numbers, bookkeeping, M/M/1 check, optimizer vs brute force, analytic model vs Monte Carlo within 4% (observed ≤ 1.2%).
- **Server fixes**: `auth.py` and `leaderboard.py` used asyncpg-style calls that do not exist in psycopg3; rewritten. The SSE `LISTEN` now quotes the channel name (it took `class_id` from the query string unquoted) and uses a direct, non-pooled Neon connection.
- **Build**: single `tsconfig.json` (the referenced `tsconfig.node.json` could not type-check); `npm test` runs once; CI workflow runs tests and build on every push, with GitHub Pages deploy behind the `PAGES_ENABLED` repository variable.

Known gaps: scoring runs in the browser, so scores are not tamper-proof (the PRD wants the server to be authoritative); the Python server still reads the old `default_v1.json`; Championship mode is not wired to the backend yet.

Rollback: `git checkout v0.1.0-scaffold`.

## v0.1.0-scaffold — 2026-11-15

Project scaffold (React + Vite client stub, FastAPI server with HiGHS/SciPy optimizers) and Neon Postgres backend (project `billowing-math-38092403`).
