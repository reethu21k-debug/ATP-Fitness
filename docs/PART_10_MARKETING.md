# Part 10 — Marketing

Campaigns, coupons, referrals, audience segmentation, and automated
birthday/festival offers for GymOS.

## What's included

| Area | Where |
|---|---|
| Schema, RLS, permission matrix, views | `supabase/migrations/0016_marketing.sql` |
| Cron scheduling | `supabase/migrations/0017_schedule_marketing_automation.sql` |
| Daily birthday/festival automation | `supabase/functions/marketing-automation/index.ts` |
| Campaign sending (send-now + scheduled sweep) | `supabase/functions/campaign-dispatch/index.ts` |
| Server Actions | `lib/actions/marketing.actions.ts` |
| Pure/testable business logic | `lib/utils/marketing-helpers.ts` |
| Types | `types/database.ts` (Part 10 section) |
| UI | `components/features/marketing/*` |
| Routes | `app/dashboard/owner/marketing`, `app/dashboard/reception/marketing` |
| Tracking routes | `app/api/marketing/track/open`, `app/api/marketing/track/click` |
| Tests | `tests/unit/marketing-helpers.test.ts` |

## Setup

### 1. Run the migrations

```bash
supabase db push
```

This applies `0016_marketing.sql` and `0017_schedule_marketing_automation.sql`
on top of Parts 1–9. No new environment variables are required — Part 10
reuses the `RESEND_API_KEY` / `EMAIL_FROM` and `TWILIO_ACCOUNT_SID` /
`TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` variables already configured in
Part 4/6.

### 2. Deploy the two new Edge Functions

```bash
supabase functions deploy marketing-automation
supabase functions deploy campaign-dispatch
```

Both expect the same secrets as the existing functions:

```bash
supabase secrets set CRON_SECRET=<your-secret>
supabase secrets set RESEND_API_KEY=<your-resend-key>
supabase secrets set EMAIL_FROM="GymOS <no-reply@yourdomain.com>"
supabase secrets set TWILIO_ACCOUNT_SID=<your-twilio-sid>
supabase secrets set TWILIO_AUTH_TOKEN=<your-twilio-token>
supabase secrets set TWILIO_WHATSAPP_FROM=<your-twilio-whatsapp-number>
supabase secrets set NEXT_PUBLIC_APP_URL=https://yourapp.vercel.app
```

### 3. Replace the placeholders in migration 0017

Before running `0017_schedule_marketing_automation.sql`, replace
`<PROJECT_REF>` and `<CRON_SECRET>` in both `cron.schedule(...)` calls, the
same way migration `0006` was handled in Part 4.

## How sending works

- **Manual, send-now campaigns**: `createCampaign({ sendNow: true })` in
  `marketing.actions.ts` calls `dispatchCampaignNow()`, which invokes the
  `campaign-dispatch` Edge Function directly with the new campaign's id.
- **Scheduled campaigns**: saved with `status: "scheduled"` and a
  `scheduled_at` timestamp. A cron job hits `campaign-dispatch` with an empty
  body every minute; the function sweeps for any campaign whose
  `scheduled_at` has passed and sends it.
- Either way, `campaign-dispatch` resolves the audience, writes one
  `campaign_recipients` row per person (a unique index prevents the same
  person ever being inserted twice for the same campaign, so a re-run is
  always safe), sends via Resend/Twilio, and updates both the recipient row
  and the campaign's aggregate counters.

## How automation works

`marketing-automation` runs once daily (07:30 UTC) and handles two
independent jobs:

1. **Birthday wishes** — for every gym with `birthday_campaign_config.is_enabled
   = true`, finds active members whose `date_of_birth` matches today's
   month/day (year is ignored) and sends the configured template.
2. **Festival offers** — for every active `festival_offers` row whose
   `occurs_on` matches today's month/day and hasn't already fired this
   calendar year (`last_sent_year`), sends the offer to every active member.

Both jobs insert a row into `automated_message_log` (unique on
`gym_id, member_id, automation_type, sent_on`) **before** sending. If that
insert fails with a unique-violation, the message was already sent today and
the loop skips ahead — this makes the whole function safe to re-run or
re-trigger without ever double-messaging someone.

## Coupons

Coupon validation is intentionally centralized in a single SQL function,
`validate_coupon(p_gym_id, p_code, p_member_id, p_purchase_amount)`, so the
same rules apply everywhere a coupon might be checked (today: the
`validateCoupon` server action used from the payments/checkout flow):

1. Coupon exists and is active
2. Within its valid date window
3. Hasn't hit its total usage limit
4. Purchase meets the minimum amount
5. This member hasn't exceeded their per-member usage limit

`redeemCoupon` is called **after** a payment is actually recorded, inserting
a `coupon_redemptions` row; a database trigger keeps `coupons.times_used` in
sync automatically (the same "ledger drives the counter" pattern used for
inventory quantity in Part 9).

## Referral program

Every active member gets a stable referral code lazily, the first time it's
needed, via `get_or_create_referral_code()` — there's no separate "generate
my code" step for staff to remember. When a referred person becomes a paying
member, `completeReferral()` issues two real one-time coupons (one for the
referrer, one for the referee) based on the gym's configured reward types
and values, valid for 90 days.

## Permissions

Per the project's RBAC rules, receptionists can **view** marketing data but
cannot create or modify it — matching the spec's "receptionist cannot ...
change settings." This is enforced in two layers:

- **Database**: permission-matrix rows (`receptionist, marketing, create,
  false`) plus RLS policies that call `has_permission('marketing', 'create'
  | 'update' | 'delete')`.
- **UI**: the reception marketing page passes `canManage={false}` into
  `MarketingDashboard`, which hides every create/edit/delete control.

## Testing

Pure logic — discount calculation, message-template filling, month/day
matching for automation, referral-code generation, and coupon rule
ordering — is extracted into `lib/utils/marketing-helpers.ts` specifically so
it can be unit tested without a live Supabase instance:

```bash
npm run test        # runs the full suite once
npm run test:watch  # watch mode
```

24 tests currently cover this module. This is the project's first automated
test suite; the same pattern (extract pure logic, test it directly) is
recommended for future parts.

## Verification performed

- `npm install` — clean
- `npx tsc --noEmit` — clean
- `npx vitest run` — 24/24 passing
- `npm run build` — all 54 routes compile and prerender successfully
