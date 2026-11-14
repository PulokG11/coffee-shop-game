-- 001_init.sql
-- Core tables: sessions, submissions, leaderboard snapshots

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE public.game_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL,
    class_id    TEXT,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    total_profit NUMERIC(12,4) DEFAULT 0,
    round_number SMALLINT NOT NULL DEFAULT 1,
    CONSTRAINT round_range CHECK (round_number BETWEEN 1 AND 8)
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.game_sessions
    FOR ALL USING (auth.uid() = user_id);

-- ── Submissions ───────────────────────────────────────────────────────────────
CREATE TABLE public.submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    round_number    SMALLINT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    -- player decision
    hot_qty         SMALLINT NOT NULL,
    cold_qty        SMALLINT NOT NULL,
    markup          NUMERIC(5,3) NOT NULL DEFAULT 0,
    service_rate    NUMERIC(4,2) NOT NULL DEFAULT 3,
    -- server-authoritative result
    seed            INT NOT NULL,
    demand_hot      SMALLINT,
    demand_cold     SMALLINT,
    sold_hot        SMALLINT,
    sold_cold       SMALLINT,
    revenue         NUMERIC(10,4),
    cost            NUMERIC(10,4),
    profit          NUMERIC(10,4),
    queue_abandoned SMALLINT DEFAULT 0,
    -- optimizer comparison
    opt_hot_qty     SMALLINT,
    opt_cold_qty    SMALLINT,
    opt_markup      NUMERIC(5,3),
    opt_expected_profit NUMERIC(10,4),
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read" ON public.submissions
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
        )
    );

-- ── Leaderboard snapshots ─────────────────────────────────────────────────────
CREATE TABLE public.leaderboard (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id     TEXT NOT NULL,
    scenario_id  TEXT NOT NULL,
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    total_profit NUMERIC(12,4) NOT NULL,
    rounds_played SMALLINT NOT NULL,
    snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON public.leaderboard (class_id, scenario_id, total_profit DESC);

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON public.leaderboard FOR SELECT USING (true);
