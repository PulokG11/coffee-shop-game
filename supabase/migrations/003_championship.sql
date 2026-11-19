-- 003_championship.sql
-- Class and weekly championships: a shared scenario and shared random streams per match,
-- anonymous players identified by a bearer token, one scored submission per round.

CREATE TABLE public.championship (
    match_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code               TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
    kind               TEXT NOT NULL CHECK (kind IN ('class', 'weekly')),
    name               TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    scenario_id        TEXT NOT NULL,
    -- Server-only: random streams for every round are derived from it
    secret             TEXT NOT NULL,
    organizer_key_hash TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.championship_player (
    player_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id     UUID NOT NULL REFERENCES public.championship(match_id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 24),
    token_hash   TEXT NOT NULL,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX championship_player_name ON public.championship_player (match_id, lower(display_name));

CREATE TABLE public.championship_round (
    player_id        UUID NOT NULL REFERENCES public.championship_player(player_id) ON DELETE CASCADE,
    round            SMALLINT NOT NULL CHECK (round BETWEEN 1 AND 8),
    decision         JSONB NOT NULL,
    profit           NUMERIC(12,2) NOT NULL,
    expected         NUMERIC(12,2) NOT NULL,
    optimal_profit   NUMERIC(12,2) NOT NULL,
    optimal_expected NUMERIC(12,2) NOT NULL,
    detail           JSONB NOT NULL,
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, round)
);
