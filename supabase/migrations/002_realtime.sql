-- 002_realtime.sql
-- LISTEN/NOTIFY trigger for leaderboard updates (replaces Supabase Realtime publication)

CREATE OR REPLACE FUNCTION public.notify_leaderboard_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('leaderboard_' || NEW.class_id, row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

CREATE TRIGGER leaderboard_notify
    AFTER INSERT OR UPDATE ON public.leaderboard
    FOR EACH ROW EXECUTE FUNCTION public.notify_leaderboard_change();
