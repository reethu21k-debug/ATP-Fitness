-- ============================================================================
-- Schedule the two Part 10 Edge Functions.
-- Replace <PROJECT_REF> and <CRON_SECRET> the same way as migration 0006.
--
-- marketing-automation: once daily at 07:30 UTC — birthday wishes + festival
--   offers (ahead of the gym's opening hours, after inventory-alerts' slot).
-- campaign-dispatch: every minute, with an empty body — sweeps for any
--   scheduled campaign whose scheduled_at has arrived. Sending itself is
--   fast (recipient loop), and the function is a no-op (near-instant) when
--   nothing is due, so a 1-minute cadence keeps scheduled-send delay low
--   without meaningful cost.
-- ============================================================================

select cron.schedule(
  'marketing-automation-daily',
  '30 7 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/marketing-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'campaign-dispatch-sweep',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/campaign-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
