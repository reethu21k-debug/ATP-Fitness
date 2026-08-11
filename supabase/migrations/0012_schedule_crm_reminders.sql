-- ============================================================================
-- Schedule crm-follow-up-reminders to run once a day at 08:30 UTC (ahead of
-- the 09:00 renewal-reminders run from Part 4, so staff see CRM follow-ups
-- before the gym opens).
-- Replace <PROJECT_REF> and <CRON_SECRET> the same way as migration 0006.
-- ============================================================================

select cron.schedule(
  'crm-follow-up-reminders-daily',
  '30 8 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/crm-follow-up-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
