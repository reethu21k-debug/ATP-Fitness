-- ============================================================================
-- Move Marketing email sending off the Resend-based Edge Functions
-- (supabase/functions/campaign-dispatch, supabase/functions/marketing-automation,
-- both now deleted) onto the app's own Gmail SMTP transport -- the same one
-- used for subscription/welcome/renewal-reminder emails
-- (lib/services/email.ts -> sendEmail).
--
-- Reason: nodemailer needs the Node runtime and doesn't run on Supabase's
-- Deno Edge Functions -- the same reason migration 0021 moved renewal
-- reminder emails onto the Next.js app instead of an Edge Function.
--
-- This unschedules the two Resend-based cron jobs from 0017 and reschedules
-- them to call the new Next.js API routes instead:
--   supabase/functions/campaign-dispatch      -> app/api/marketing/campaign-dispatch
--   supabase/functions/marketing-automation   -> app/api/cron/marketing-automation
--
-- Replace <APP_URL> and <CRON_SECRET> with real values before running (same
-- CRON_SECRET as in your .env -- see app/api/cron/renewal-reminders for the
-- existing example of this pattern).
-- ============================================================================

select cron.unschedule('marketing-automation-daily');
select cron.unschedule('campaign-dispatch-sweep');

select cron.schedule(
  'marketing-automation-smtp-daily',
  '30 7 * * *', -- once a day at 07:30 UTC, same slot as the old job
  $$
  select net.http_get(
    url := '<APP_URL>/api/cron/marketing-automation',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
  $$
);

select cron.schedule(
  'campaign-dispatch-smtp-sweep',
  '* * * * *', -- every minute, same cadence as the old job
  $$
  select net.http_post(
    url := '<APP_URL>/api/marketing/campaign-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
