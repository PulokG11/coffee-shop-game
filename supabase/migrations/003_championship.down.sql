-- Rolls back 003_championship.sql (deletes all championship data).
DROP TABLE IF EXISTS public.championship_round;
DROP TABLE IF EXISTS public.championship_player;
DROP TABLE IF EXISTS public.championship;
