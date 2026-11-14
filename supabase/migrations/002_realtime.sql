-- 002_realtime.sql
-- Enable Supabase Realtime on leaderboard for live SSE updates

ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;

-- Notify on leaderboard change so clients refresh
CREATE OR REPLACE FUNCTION public.notify_leaderboard_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('leaderboard_' || NEW.class_id, row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

CREATE TRIGGER leaderboard_realtime
    AFTER INSERT OR UPDATE ON public.leaderboard
    FOR EACH ROW EXECUTE FUNCTION public.notify_leaderboard_change();
