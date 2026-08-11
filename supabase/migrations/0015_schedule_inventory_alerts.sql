-- ============================================================================
-- Schedule inventory-alerts to run weekly, Monday 07:00 UTC.
-- Replace <PROJECT_REF> and <CRON_SECRET> the same way as migration 0006.
-- ============================================================================

select cron.schedule(
  'inventory-alerts-weekly',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/inventory-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
