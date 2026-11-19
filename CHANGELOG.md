# Changelog

Every release is a git tag. To roll back, check out the previous tag (whole repo) or restore single files from it:

```bash
git checkout v0.1.0-scaffold -- src scenarios
git commit -m "rollback: client to v0.1.0-scaffold"
```

## v0.4.0-championship — 2026-11-19

Championship mode (PRD FR-CHP-01 to 08).

- **Class matches**: create with a name, optional custom code (reported if taken) and how long it stays open; players join with the code and a display name (unique per match, length-limited, screened for offensive words including look-alike spellings). Organizers can delete a match and all its scores, from the device that created it or with their organizer key.
- **Global weekly match**: no code; a new variant of the eight rounds each ISO week, rolling over Monday 00:00 UTC, with a countdown.
- **Fair, server-scored rounds**: a Neon Function (`api/index.ts`) re-scores every plan with the same engine code on shared random streams from a server-side secret. One submission per round, in order; resubmitting returns the stored result. The optimizer's plan is never sent.
- **Leaderboard** of total profit, refreshed every 5 seconds, with your row marked; your rank after each round on the results screen.
- **Separate saves**: a solo game and a championship game are kept side by side on the device; existing solo saves carry over.
- **Data**: migration `003_championship.sql` (tables `championship`, `championship_player`, `championship_round`), applied to Neon. `npm run test:api` runs 24 end-to-end checks.

Rollback: `git checkout v0.3.0-redesign -- src` restores the client without Championship mode. The API and tables can stay; `003_championship.down.sql` drops the tables and all championship data.

## v0.3.0-redesign — 2026-11-18

Visual redesign, reviewed against the Gurobean screens but with its own identity: café chalkboard, order tickets and a till instead of the earlier cream dashboard.

- **Shop scene** is larger (900×420) and the window follows the simulated clock: night, dawn, day and dusk skies, sun and moon, lit city windows after dark, an "Open 24h" neon that glows at night, pendant lamps, a chalk menu showing the round's real prices, BrewBot stock tanks, walking customers with varied looks.
- **Play screen**: framed stage with a chalkboard HUD and tactile speed buttons, live numbers on a till display, decision panels as order tickets hanging from a rail, and a "Feasible / Infeasible" rubber stamp.
- **New**: round briefing with a table of the day's numbers (prices, costs, beans and water per cup, supplies, arrivals, barista speed); a "Lock in this plan?" confirmation before scoring.
- **Home**: illustrated shopfront at blue hour with the play buttons on a sidewalk chalkboard. **Results and summary**: till-style scores and a receipt.
- **Type and color**: Lilita One (display) and Lexend (text), bundled with the app; chalkboard green, chalk, receipt paper, coffee-cherry red and marigold. Chart colors are unchanged.
- **Fixes**: the canvas no longer forces the play screen wider than a phone; dialogs render in a portal so the ticket's shadow filter cannot trap them.

Rollback: `git checkout v0.2.1-readme -- src index.html tailwind.config.ts package.json package-lock.json` (the engine and scenario did not change).

## v0.2.1-readme — 2026-11-15

README links the live site. No app changes.

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
