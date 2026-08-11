-- ============================================================================
-- Add 'on_expiry' to reminder_type -- the existing enum only has offsets of
-- 1/3/7/30 days after expiry, with no value for "the day it actually
-- expires". The new renewal reminder emails (7d/3d/1d before, immediately
-- on expiry) need that fourth window.
-- ============================================================================

alter type public.reminder_type add value if not exists 'on_expiry';

-- ============================================================================
-- Schedule the new email-only renewal reminders (7d/3d/1d before + on
-- expiry, sent via the app's Gmail SMTP transport) to run once a day.
-- This is separate from the existing renewal-reminders-daily job (which
-- still handles WhatsApp + its own best-effort Resend email on a wider
-- set of windows) -- this one calls the Next.js app directly instead of a
-- Supabase Edge Function, since nodemailer needs the Node runtime.
--
-- Replace <APP_URL> and <CRON_SECRET> with real values before running
-- (same CRON_SECRET as in your .env -- see app/api/cron/renewal-reminders).
-- ============================================================================

select cron.schedule(
  'renewal-reminder-emails-daily',
  '0 9 * * *', -- every day at 09:00 UTC
  $$
  select net.http_get(
    url := '<APP_URL>/api/cron/renewal-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
  $$
);