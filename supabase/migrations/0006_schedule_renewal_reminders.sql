-- ============================================================================
-- Schedule the renewal-reminders Edge Function to run once a day at 09:00 UTC.
-- Requires the pg_net extension (for HTTP calls from Postgres) and the
-- `app.settings.cron_secret` / `app.settings.edge_function_url` GUCs to be
-- set via `alter database postgres set ...` from the Supabase dashboard, or
-- replace the placeholders below directly before running this migration.
-- ============================================================================

create extension if not exists pg_net;

-- NOTE: Replace these two placeholders with your actual project values
-- before applying this migration (Supabase doesn't allow reading secrets
-- from within SQL migrations for security reasons):
--   <PROJECT_REF>   e.g. abcdefghijklmnop
--   <CRON_SECRET>   the same value as CRON_SECRET in your Edge Function env

select cron.schedule(
  'renewal-reminders-daily',
  '0 9 * * *', -- every day at 09:00 UTC
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/renewal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);