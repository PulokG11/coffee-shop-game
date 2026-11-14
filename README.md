# Coffee Shop Game

Browser-based educational simulation inspired by the Gurobean game (Gurobi / Prof. Larry Snyder, Lehigh University). Players manage an 8-round coffee shop, learning inventory optimisation, pricing, and queueing under uncertainty.

## Tech Stack (100% free / OSS)

| Layer | Technology |
|---|---|
| Client | React 19 · TypeScript · Vite · Tailwind CSS · Canvas 2D · Zustand |
| Client worker | TypeScript Web Worker (live DES simulation) |
| Server | FastAPI (Python 3.12) · NumPy · SciPy · HiGHS (via highspy) |
| Database | Supabase Postgres 15 · Realtime · Auth · Storage |
| Rate limiting | Upstash Redis (free tier) |
| Client hosting | Vercel (free hobby) |
| Server hosting | Railway (free tier, stateless workers) |
| Testing | Vitest · pytest · Playwright · k6 |

## Project Structure

```
coffee-shop-game/
├── src/                    # React + TypeScript client
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── stores/             # Zustand stores
│   ├── workers/            # Web Workers (simulation, model)
│   ├── lib/
│   │   ├── simulation/     # Client-side DES preview
│   │   ├── model/          # Analytic expected-profit model
│   │   └── api/            # Supabase + server API clients
│   ├── types/              # Shared TypeScript types
│   └── pages/              # Page components
├── server/                 # FastAPI Python server
│   ├── app/
│   │   ├── routers/        # simulate, optimize, scenarios endpoints
│   │   ├── simulation/     # Authoritative DES (des.py)
│   │   ├── optimizer/      # HiGHS LP (Rounds 1-4), SciPy DE (Rounds 5-8)
│   │   └── schemas/        # Pydantic request/response models
│   └── tests/              # pytest test suite
├── supabase/
│   ├── migrations/         # Numbered SQL migrations + .down.sql rollbacks
│   ├── seed/               # Reference + test data
│   └── functions/          # Deno edge functions (future)
├── scenarios/              # Versioned JSON scenario packages
├── assets/                 # Images, audio, fonts
├── docs/                   # Design docs, GDD, PRD, TADD
└── .github/workflows/      # CI/CD (Vitest, pytest, Playwright)
```

## Getting Started

### Client

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest unit tests
npm run typecheck  # TypeScript check
```

### Server

```bash
cd server
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # Mac/Linux
pip install -e ".[dev]"
uvicorn app.main:app --reload   # http://localhost:8000
pytest                          # test suite
```

### Environment

Copy `.env.example` to `.env` and fill in your Supabase project keys.

### Supabase migrations

```bash
supabase db push --project-ref <your-ref>
```

## Round Design

| Round | New constraint | Optimizer |
|---|---|---|
| 1 | Newsvendor (hot only) | HiGHS LP |
| 2 | Add cold drinks | HiGHS LP |
| 3 | Bean + water capacity | HiGHS LP |
| 4 | Multiple drink types | HiGHS LP |
| 5 | Price markup | SciPy DE |
| 6 | Queue balking | SciPy DE |
| 7 | Service rate | SciPy DE |
| 8 | Full complexity | SciPy DE |
