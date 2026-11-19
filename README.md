# Coffee Shop Game

Browser-based teaching game inspired by Gurobean (Gurobi Optimization and Prof. Larry Snyder, Lehigh University); independent and not affiliated. You run a coffee shop for eight rounds, choosing how much hot and cold coffee to brew each hour, then the price and the barista's speed, and try to beat an optimizer while customers arrive at random.

**▶ Play it now: https://pulokg11.github.io/coffee-shop-game/**

## Play

Open the link above in a desktop browser (tablets and phones work too). To run it locally instead:

```bash
npm install
npm run dev        # http://localhost:5173
```

The whole game (simulation, monitors, optimizer, scoring) runs in the browser, so `npm run build` produces a static site in `dist/`.

## Rounds (`scenarios/default_v2.json`)

| Round | New wrinkle | Best plan (expected 5-day profit) |
|---|---|---|
| 1 | Hot coffee only, no brewing cost, beans and water limits | 45 hot/h — the bean limit binds |
| 2 | Hot and cold share the resources | 31 hot, 18 cold |
| 3 | Hot cups cost $1.20 to brew | 35 hot, 28 cold |
| 4 | Both drinks cost money | 40 hot, 25 cold — on the bean limit |
| 5 | Markup is a decision; higher prices mean fewer customers | markup $2.90 |
| 6 | Customers balk at long lines | markup rises to $3.80 |
| 7 | Orders of 1–3 cups | markup $3.90 |
| 8 | Barista skill is a decision (costs $0.60/h per customer/h) | barista 51, markup $3.70 |

## How it works (`src/engine/`)

| File | What it does |
|---|---|
| `rng.ts` | Seeded streams (arrivals, drink, order size, service, balking). Each customer uses one draw per stream, so two plans run with the same seed meet the same customers. |
| `sim.ts` | Discrete-event simulation: hour boundary (waste leftovers, brew and pay for the next batch), arrival (maybe balk), service completion (sell what is in stock). |
| `model.ts` | Expected profit per hour: Normal newsvendor per drink, demand moments from a birth–death queue with balking and compound-Poisson orders. |
| `optimizer.ts` | Exact maximum of the model over every slider setting: enumerates markup × barista, and for each hot quantity reads the best feasible cold quantity from a running arg-max. |

`npm test` checks reproducibility, common random numbers, bookkeeping, the optimizer against brute force, and the model against Monte Carlo (within 4%; observed ≤ 1.2%).

## Project structure

```
coffee-shop-game/
├── src/
│   ├── engine/      # simulation, analytic model, optimizer, scenario loader (+ tests)
│   ├── components/  # shop scene, panels, monitors, comparison, summary
│   ├── store/       # game state (saved in localStorage) and live-simulation state
│   └── lib/         # formatting, tips, API client for the server (neon.ts, not used yet)
├── scenarios/       # versioned scenario packages
├── api/             # Championship API (Neon Function), reuses src/engine
├── scripts/         # API bundling, local server and end-to-end checks
├── server/          # Older FastAPI server, not used by the game
└── supabase/migrations/  # SQL for the Neon Postgres database
```

## Championship mode

- **Class match**: an organizer creates a match (name, optional custom code, open for 7/30/90 days) and shares the code; players join with the code and a display name. The organizer gets a key that lets them delete the match.
- **Global weekly match**: no code. Each ISO week (Monday 00:00 UTC) plays its own variant of the eight rounds (`src/engine/weekly.ts`: demand, supplies and costs move within fixed ranges).
- Everyone in a match faces the same customers: each round's seed comes from a server-side secret. Plans are re-scored on the server with the same engine code; one submission per round, in order. The optimizer's plan is never sent, only its profit.
- Leaderboard of total profit, refreshed every 5 seconds.

The API is a Neon Function (`api/index.ts`, slug `api`) on the Neon project's `main` branch, public URL in `.env.production`. It uses Neon's HTTP SQL endpoint, so the bundle has no dependencies.

```bash
npm run api:build                       # bundle + zip into dist-api/
npm run api:dev                         # run it locally on :8787 (needs DATABASE_URL in .env.local)
API_URL=<url> npm run test:api          # end-to-end checks; cleans up its own match
```

Deploy by uploading `dist-api/api.zip` (base64 in `dist-api/api.zip.b64`) as function `api` on branch `br-crimson-heart-az01ah7f` of project `billowing-math-38092403` (Neon MCP `deploy_function`, or the Neon CLI). Tables: `supabase/migrations/003_championship.sql`.

## Python server (older, not used by the game)

```bash
cd server
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload   # http://localhost:8000
```

Copy `.env.example` to `.env` and set `DATABASE_URL` (Neon pooled connection string) and `JWT_SECRET` (`openssl rand -hex 32`). Apply migrations with `psql "$DATABASE_URL" -f supabase/migrations/001_init.sql` and `002_realtime.sql` (already applied to Neon project `billowing-math-38092403`). The server still reads `scenarios/default_v1.json`.

## Deploy

The game is hosted on GitHub Pages at https://pulokg11.github.io/coffee-shop-game/.

`.github/workflows/pages.yml` runs the tests and the build on every push and pull request. Every push to `main` then redeploys the site, because the repository variable `PAGES_ENABLED` is `true`. To stop publishing, set `PAGES_ENABLED` to `false`; to take the site down, also turn off Pages in Settings → Pages.

See `CHANGELOG.md` for releases and rollback.
