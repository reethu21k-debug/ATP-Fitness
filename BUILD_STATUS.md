# GymOS — Build Status

This file tracks exactly what has been built, part by part, so nothing gets
skipped and nothing gets silently re-simplified. Update this file at the end
of every part.

## ✅ Part 1 — Foundation (DONE)
- Project scaffold: Next.js 15 App Router, TypeScript strict, Tailwind + shadcn tokens
- `package.json` with full mandated stack (TanStack Query/Table, RHF+Zod, Framer Motion,
  Recharts, Cloudinary, Radix primitives, QR, PDF/Excel export, Resend, Twilio)
- Design tokens: light + dark mode, glassmorphism utilities
- Database: `tenants`, `gyms`, `profiles`, `permissions`, `staff_permission_overrides`,
  `audit_logs`, `support_tickets`
- Auth trigger: `handle_new_auth_user` auto-creates a `profiles` row on signup
- RBAC core: `app_role` enum (5 roles), SECURITY DEFINER helper functions
  (`current_role`, `current_tenant_id`, `has_permission`, `is_super_admin`, etc.)
- Full RLS policies on every Part 1 table
- Supabase client trio: browser client, server client, admin (service-role) client
- `middleware.ts` — session refresh + route protection + role-segment guard
  (`/dashboard/owner`, `/dashboard/reception`, `/dashboard/trainer`,
  `/dashboard/member`, `/dashboard/platform`)
- `lib/utils/permissions.ts` — `requirePermission`/`requireRole` guards for Server Actions
- Hand-authored `types/database.ts` for Part 1 tables (superseded by
  `npm run db:types` once schema is complete)

## ✅ Part 2 — Auth UI + Landing Website (DONE)
- Core UI primitives: Button (CVA variants, fixed a real Radix `Slot`
  `React.Children.only` bug when `asChild` + `loading` were combined), Input, Label, Card
- Auth Server Actions (`lib/actions/auth.actions.ts`): email login, phone OTP
  request/verify, Google/Apple OAuth, atomic gym registration (tenant + gym +
  owner profile, with rollback on partial failure), forgot/reset password,
  full TOTP 2FA enroll/verify/disable
- Auth pages: Login (email/phone/2FA tabs), Register Gym, Forgot/Reset Password,
  `/register` convenience redirect, OAuth callback route handler
- Landing site: Home, Features, Pricing, Gallery, Blog (+ dynamic post pages),
  Testimonials, Contact (real lead-capture form), About, Terms, Privacy
- New migration `0002_marketing_leads.sql` — decoupled anonymous contact-form
  leads from tenant-scoped `support_tickets` (caught before shipping: the
  original plan would have violated a NOT NULL tenant FK)
- Root layout: Inter font, dark/light theme with anti-flash boot script,
  TanStack Query provider, Sonner toasts
- **Verified, not just written**: ran `npm install`, `tsc --noEmit` (clean),
  and a full `next build` — caught and fixed 2 real bugs (an untyped
  `require()` call, and the Slot/children bug above) before packaging

## ✅ Part 3 — Members Module (DONE)
- Migrations `0003_members_module.sql` + `0004_seed_default_plans.sql`:
  `membership_plans`, `member_details`, `member_memberships` (with a trigger
  enforcing one "current" membership per member), `member_documents`, a
  `members_overview` SQL view for the table UI, full RLS on every table, and
  auto-seeding of 1/3/6/12-month plans whenever a gym is created
- Cloudinary: signed direct-to-Cloudinary uploads (`/api/cloudinary/sign`,
  auth-gated) so files never pass through our server; `PhotoUpload` widget
  with preview/progress/remove
- **Automatic account creation** (`createMember` Server Action): generates a
  random password, creates the Supabase auth user, forces `must_reset_password`,
  and sends both a welcome email (Resend) and WhatsApp message (Twilio) with
  the credentials — both best-effort so notification failures never block
  member creation; full rollback of the auth user if any DB step fails
- Member CRUD: `updateMember`, `deactivateMember` (soft), `deleteMember`
  (gym-owner only, hard delete via cascade), `listMembers` (server-side
  search/filter/sort/pagination for TanStack Table)
- Dashboard shell: role-aware sidebar/topbar layout used by every future
  dashboard page, not just Members
- Members list (TanStack Table + Query), full registration form (photo,
  demographics, medical, emergency contact, plan + payment), and a tabbed
  member profile page (Overview/Membership/Medical/Documents) — for both
  Gym Owner and Receptionist routes, respecting their different permissions
  (receptionist can't delete, matching the spec)
- Real (non-placeholder) Owner and Receptionist overview dashboards, backed
  by actual aggregate queries against the new tables
- **Verified**: `npm install`, `tsc --noEmit` (clean), full `next build` —
  all 30 routes compile and prerender, including every new dashboard page

## ✅ Part 4 — Membership Renewals & Payments (DONE)
- Migrations `0005_payments_and_renewals.sql`, `0006_schedule_renewal_reminders.sql`,
  `0007_permission_matrix_payments.sql`: `payments`, `payment_splits`, `refunds`,
  `emi_installments`, `renewal_reminder_log`, gapless per-gym invoice/receipt
  number sequences (`next_invoice_number`/`next_receipt_number` SQL functions),
  a `payments_overview` view, full RLS, and extended the Part-1 permission
  matrix (gym_owner was missing explicit `payments`/`refunds` grants — caught
  before it silently blocked owners from recording payments)
- `recordPayment`: cash/UPI/card/bank/split with GST calc, split-amount
  validation against the total, auto-generated invoice + receipt numbers,
  and keeps the membership's `amount_paid`/`payment_status` in sync
- `renewMembership`: closes the current period and opens the next one,
  correctly continuing from the existing `end_date` (or today, if already
  expired), with an optional payment recorded in the same action
- `issueRefund` (gym-owner only), `createEmiPlan` / `recordEmiInstallmentPayment`
  for installment-based memberships
- **Renewal reminder Edge Function** (Deno, `supabase/functions/renewal-reminders`):
  sends email + WhatsApp at 30/15/7/3/1 days before expiry and 1/3/7/30 days
  after, de-duplicated via `renewal_reminder_log`, scheduled through
  `pg_cron` + `pg_net` (migration includes the exact schedule call — project
  ref/secret placeholders need filling in per-deployment, documented inline)
  — added a shared-secret header check so the function can't be triggered by
  anyone who finds the URL
- UI: a combined Renew/Record-Payment dialog (tabs, split-payment row
  builder) wired into the member profile's Membership tab; a payments list
  (search/filter/pagination) for both Owner and Reception; a print-friendly
  invoice/receipt page (dashboard chrome hidden via print CSS, not a
  separate layout hack)
- Excluded `supabase/functions` (Deno runtime) from the Next.js `tsconfig` —
  it has its own runtime and shouldn't be type-checked against Node/Next types
- **Verified**: `npm install`, `tsc --noEmit` (clean), full `next build` —
  all 32 routes compile and prerender

## ✅ Part 5 — Attendance (DONE)
- Migrations `0008_attendance.sql`, `0009_permission_matrix_attendance.sql`:
  `attendance_records` with a unique partial index enforcing one open
  (not-checked-out) session per member at the DB level — not just app-level
  validation — a trigger that auto-computes visit duration on checkout, an
  `attendance_today` view, full RLS, and the same missing-gym_owner-grant fix
  pattern from Parts 3/4 (added `attendance` create/read explicitly)
- **Stateless rotating QR** (`lib/services/qr-token.ts`): HMAC-SHA256 signed
  tokens bucketed into 20-second windows — no token table, no cleanup job,
  can't be replayed outside its window (with 1 window of clock-skew
  tolerance), and uses a constant-time comparison
- Check-in validation chain, exactly per spec: QR freshness → active
  membership → duplicate-session check → optional GPS proximity (haversine
  distance against the gym's stored radius) — all four gates in one action,
  with the DB unique index as a second line of defense against race conditions
- UI: a kiosk display (`/attendance/kiosk`) that polls a staff-only signed
  endpoint every 20s and renders the QR; a member-facing camera scanner
  (html5-qrcode) with check-in/check-out state and visit history; a front-desk
  dashboard with peak-hours (Recharts), today's-members table, and average
  workout duration — all backed by real queries, not mock data
- Manual check-in override for front desk (member forgot their phone)
- **Verified**: `npm install`, `tsc --noEmit` (clean), full `next build` —
  all 38 routes compile and prerender

## ✅ Part 6 — Trainer Module (DONE)
- Migration `0010_trainer_module.sql`: `workout_plans`/`workout_days`/`workout_exercises`,
  `diet_plans`/`diet_meals`, `member_progress` (measurements/BMI inputs/body fat),
  full RLS scoped so a trainer only touches their own assigned clients' plans
  (gym owner and super admin retain full visibility), and permission-matrix
  additions for trainer/gym_owner/member on the new resources
- Workout planner: daily/weekly/monthly frequency, dynamic days with dynamic
  exercises (sets/reps/weight/video URL/notes) via nested `useFieldArray`
- Diet planner: daily macro targets + breakfast/lunch/dinner/snacks with
  per-meal calories and macros
- Progress tracking: weight/body-fat/measurements entries, with a
  week/month/year toggleable Recharts line chart (switchable between weight,
  body fat %, and waist) — BMI computed live from latest weight + stored height
- Trainer UI: "My Clients" (assigned members only) → per-client workspace
  with Workouts/Diet/Progress tabs
- Member-facing read-only Workout and Diet pages, plus a **real** member
  overview dashboard (latest weight, BMI, membership status, quick links) —
  the member portal had no home page until now
- **Caught a real bug at build time, not just typecheck**: `calculateBmi`
  was a synchronous pure function living in a `"use server"` file — Next.js
  requires every export from such a file to be an async Server Action, and
  the build (not the type checker) is what caught it. Moved it to
  `lib/utils/fitness.ts`, a plain (non-`"use server"`) module — the correct
  home for pure helpers, and the seed for the standalone Fitness Calculator
  feature later
- **Verified**: `npm install`, `tsc --noEmit` (clean), full `next build` —
  all 43 routes compile and prerender

## ✅ Part 7 — Receptionist & CRM (DONE)
- Migrations `0011_crm.sql`, `0012_schedule_crm_reminders.sql`: `leads` +
  `lead_activities`, a trigger that auto-logs every pipeline status change
  as an activity (so the timeline is always complete without extra app
  code), a `leads_overview` view, full RLS, and permission-matrix rows
  (receptionist can create/read/update leads but not delete — same pattern
  as members)
- Pipeline board: New → Contacted → Trial Scheduled → Trial Completed →
  Converted/Lost, with a lead detail dialog (activity timeline, one-click
  stage advance, mark-lost with reason, follow-up date editor, notes)
- **Conversion reuses the real Members flow** rather than duplicating it:
  `convertLeadToMember` calls the same `createMember` action from Part 3
  (auto account creation, email/WhatsApp welcome, forced password reset)
  and then marks the lead converted — extended `MemberForm` with an optional
  `leadId`/`defaultValues` prop instead of writing a second form
- Second scheduled Edge Function (`crm-follow-up-reminders`, 08:30 UTC
  daily): groups leads due for follow-up today by assigned staff member and
  sends one summary email per staff member, not one per lead
- CRM dashboard stats (total leads, new this week, converted, conversion
  rate) computed from real queries, plus a same-day due-follow-ups banner
- **Verified**: `npm install`, `tsc --noEmit` (clean), full `next build` —
  all 45 routes compile and prerender

## ✅ Part 8 — AI Features (DONE)
- `lib/services/anthropic.ts`: server-only Claude API wrapper (`claude-sonnet-5`)
  with a strict JSON-generation mode for structured outputs (workout/diet
  plans) and a plain-text mode for narratives/chat
- Migration `0013_ai_features.sql`: `ai_chat_messages`, `member_risk_scores`,
  `revenue_forecasts` — AI outputs are cached in the DB rather than
  recomputed on every page view, with full RLS
- **AI Workout Generator**: embedded directly in the existing trainer
  workout-plan dialog from Part 6 (goal/level/days-per-week/equipment/
  injuries → structured JSON plan) — the trainer reviews and edits the
  AI's output in the same form before saving, it's never auto-saved blind
- **AI Diet Generator**: same pattern in the diet-plan dialog, with macros
- **AI Chat Assistant**: member-facing fitness Q&A with conversation history,
  medical-context awareness from their profile, and an explicit system-prompt
  instruction to defer to a doctor/trainer for pain or medical symptoms
  rather than self-treating
- **Cancellation prediction / member risk analysis**: deliberately NOT
  "ask the LLM for a risk score" — risk is computed from real signals
  (attendance trend vs. prior 30 days, days to/past expiry, payment status)
  with a transparent rule-based scorer; AI is used only to write a short
  actionable staff note for the top 5 highest-risk members, never to invent
  the underlying numbers
- **Revenue forecast**: same principle — next-3-months projection comes from
  real linear regression over actual payment history, not an LLM guess; AI
  adds only the plain-English narrative interpretation of an already-computed
  trend
- New Owner "AI Insights" page combining both, each with its own "run now"
  button (analysis isn't recomputed on every page load — these cost real
  API calls)
- **Verified**: `npm install`, `tsc --noEmit` (clean — including a real
  TS narrowing edge case in the chat handler that needed restructuring, not
  just a type assertion), full `next build` — all 47 routes compile and
  prerender

## ✅ Part 9 — Inventory & Payroll (DONE)
- Migrations `0014_inventory_payroll.sql`, `0015_schedule_inventory_alerts.sql`:
  `inventory_items` + `inventory_transactions` (quantity is derived from
  transactions via trigger — never edited directly, so stock history is
  always reconstructable), `staff_salary_config`, `payslips`, permission-matrix
  rows, full RLS (payroll is gym-owner-only — salary data is sensitive)
- Third scheduled Edge Function (`inventory-alerts`, weekly Monday 07:00 UTC):
  low-stock + expiring-within-30-days digest, one email per gym owner
- Inventory: add item, restock/sale/damage/manual-adjustment stock ledger,
  search/category/low-stock filters, barcode field, expiry tracking
- Payroll: per-staff base salary + commission rate config; payslip generation
  auto-computes commission from actual payments that staff member processed
  that month (not a guess), with optional attendance-based pro-rating of
  base salary, bonus, and deductions; printable payslip reusing the Part 4
  print-CSS pattern
- **Verified**: `npm install`, `tsc --noEmit` (clean), full `next build` —
  all 50 routes compile and prerender

## ✅ Part 10 — Marketing (DONE)
- Migrations `0016_marketing.sql`, `0017_schedule_marketing_automation.sql`:
  `marketing_campaigns` + `campaign_recipients` (per-recipient send/open/click
  tracking, unique constraints preventing double-sends), `coupons` +
  `coupon_redemptions` (usage counter driven by a trigger off the redemption
  ledger — same "ledger drives the counter" pattern as Part 9 inventory),
  `referral_program_config` + `referrals`, `audience_segments`,
  `festival_offers` + `birthday_campaign_config` + `automated_message_log`
  (idempotency log so daily automation never double-sends), permission-matrix
  rows (`receptionist` = read-only, matching the spec), full RLS, plus
  `campaign_analytics` / `referrals_overview` / `coupons_overview` views
- **Coupon validation is server-authoritative**: a `validate_coupon()` SQL
  function checks active window, usage caps (total + per-member), and
  minimum purchase — the same function a receptionist's checkout screen and
  any future member-facing checkout both call, so the rule can never be
  bypassed by a client-side-only check
- **Campaigns**: composer supports email/WhatsApp/both, six audience types
  (all/active/expired/expiring-soon/frozen members, open leads, or a custom
  member selection) plus a live audience-size estimate before sending;
  send-now or schedule-for-later; per-recipient delivery log with open/click
  tracking via two public tracking routes (`/api/marketing/track/open` —
  1x1 pixel, `/api/marketing/track/click` — redirect-and-record), both using
  the admin client since email clients have no session
- **Referral program**: every active member gets a stable, auto-generated
  shareable code (`get_or_create_referral_code()`); configurable
  referrer/referee rewards, each issued as a real one-time coupon on
  conversion rather than a vague "reward" flag
- **Automation**: two Edge Functions — `marketing-automation` (daily,
  birthday wishes + festival offers, idempotent per person per day) and
  `campaign-dispatch` (send-now via direct invoke, or a 1-minute cron sweep
  for scheduled campaigns) — both reuse the exact Resend/Twilio send pattern
  from `renewal-reminders`
- Marketing dashboard (Campaigns / Coupons / Referrals / Automation tabs) on
  both Owner (full access) and Reception (read-only, per the permission
  matrix) with live stats: campaigns sent, messages sent, active coupons,
  pending referrals, average open rate
- Pure business logic (discount calculation, template filling, month/day
  matching, referral code generation, coupon rule ordering) extracted into
  `lib/utils/marketing-helpers.ts` and covered by a new Vitest unit-test
  suite (`tests/unit/marketing-helpers.test.ts`, 24 tests) — the project's
  first automated test coverage
- **Verified**: `npm install`, `tsc --noEmit` (clean), `vitest run` (24/24
  passing), full `next build` — all 54 routes compile and prerender

## ✅ Part 11 — Reports & Analytics (DONE)
- Migration `0018_reports_analytics.sql`: new `expenses` table (RLS,
  gym-owner only) plus read-only SQL functions for every report — revenue,
  membership summary, attendance, trainer performance, inventory, payments-
  by-method, and profit & loss (revenue vs. manual expenses + finalized/paid
  payroll net pay, so payroll isn't double-counted) — and analytics
  functions for growth, renewal rate (renewed-within-14-days), and 6-month
  joining-cohort retention. Permission-matrix rows explicitly block
  `receptionist` from `reports`/`expenses`, matching the spec's "cannot view
  revenue reports" restriction
- Every time-series report/analytics function takes an explicit
  `[p_start, p_end]` window — nothing defaults to "all time" silently
- Server Actions (`lib/actions/reports.actions.ts`): one per report, all
  `has_permission`-gated, plus full expense CRUD and a combined KPI summary
  that reuses the same P&L/attendance queries rather than recomputing them
- Dashboard at `/dashboard/owner/reports` — 9 tabs (Revenue, Membership,
  Attendance, Trainer Performance, Inventory, Payments, Expenses, Profit &
  Loss, Analytics) sharing one date-range picker with quick presets; every
  tab exports to **PDF and Excel client-side** (`jspdf`/`jspdf-autotable`,
  `xlsx` — already-installed deps, no new packages)
- `/dashboard/owner/revenue` (an orphaned nav link from before this module
  existed) now redirects into Reports, whose default tab is Revenue
- Analytics deliberately reuses Part 8's real linear-regression revenue
  forecast (via `revenue_forecasts` + a link into AI Insights) instead of
  building a second, competing forecaster
- **Verified**: `npm install`, `tsc --noEmit` (clean), `vitest run` (24/24
  still passing — unaffected by this module), full `next build` — all 56
  routes compile and prerender

## ✅ Part 12 — Super Admin Console (DONE)
- Migration `0019_super_admin_console.sql`: `subscription_plans` (the
  platform's own pricing catalog — trial/starter/growth/enterprise, seeded —
  distinct from a gym's `membership_plans`, which is what a gym sells to its
  own members), `platform_invoices` (SaaS billing issued *to* tenants, with
  gapless numbering via `next_platform_invoice_number()`), `feature_flag_catalog`
  (a named/described registry of flags, seeded, that gives the per-tenant
  `tenants.feature_flags` jsonb from Part 1 an actual toggle UI instead of
  hand-typed JSON keys), `platform_settings` (singleton config row),
  `support_ticket_messages` (threaded replies on the existing `support_tickets`
  table, with a super-admin-only `is_internal_note` flag), and
  `tenant_admin_actions` (a dedicated audit log for suspend/reactivate/
  plan-change/flag-toggle, separate from the generic audit trail so the most
  sensitive platform powers are always independently queryable)
- Server-authoritative `suspend_tenant()` / `reactivate_tenant()` SQL
  functions — suspension can never be a client-only UI flag, and every call
  writes its own audit row inside the same function, atomically
- Platform-wide analytics functions: `platform_overview_stats()` (tenant
  counts by status + MRR, computed from `subscription_plans.monthly_price ×
  active tenants`, not a stored/stale number), `platform_tenant_growth()`
  (month-by-month new + cumulative tenants), `tenant_usage_summary()` (gyms/
  staff/members/revenue for one tenant), `platform_ticket_stats()`
- Full RLS on every table: super-admin-only by default, with narrow
  read-only exceptions so a gym owner can see their own tenant's invoices
  and non-internal ticket replies (never another tenant's, never an
  internal note)
- Server Actions (`lib/actions/platform.actions.ts`): a shared
  `asSuperAdmin()` wrapper collapses `requireRole` + try/catch into one
  place; full CRUD for tenants (suspend/reactivate/plan-change/feature-flag-
  toggle/white-label), subscription plans, platform invoices, the feature
  flag catalog, support tickets (list/reply/status), and platform settings —
  plus a tenant-side counterpart (`createSupportTicket`, `listMyTenantTickets`,
  `replyToMyTicket`) scoped by RLS to the caller's own tenant, not gated by
  `requireRole`
- Dashboard at `/dashboard/platform` (Overview — MRR, tenant/gym/member
  counts, 12-month growth chart, ticket-status summary), `/tenants`
  (searchable/sortable/paginated table → detail page with usage stats,
  suspend/reactivate, plan change, per-tenant feature-flag overrides,
  white-label branding form, and full admin-action history), `/billing`
  (Subscription Plans + Invoices tabs), `/tickets` (list → threaded detail
  view with internal notes), `/settings` (platform config + feature flag
  catalog editor) — all previously-orphaned nav links from the sidebar's
  `super_admin` section, now wired up
- **Design choice**: feature flags are two-layer by design — the catalog
  table defines *what* a flag means and its platform-wide default; the
  actual per-tenant on/off state still lives in the `tenants.feature_flags`
  jsonb column added all the way back in Part 1, so nothing needed to
  change about how the rest of the app reads flags, only how they're now
  discoverable and toggleable from an admin UI
- **Design choice**: closed the last orphaned nav link in the project — the
  gym owner's `Settings` link had never had a page behind it. Rather than
  build a full settings module (out of scope for this part), it now hosts
  exactly what Part 12 needs: a subscription/billing-status card and a
  "raise a support ticket" panel that talks to the same `support_tickets`
  table the platform side manages, reusing the same status/priority badge
  components on both sides of the conversation
- One real TypeScript subtlety, same shape as the one flagged in Part 8: a
  shared `asSuperAdmin<T>()` helper defaults to `T = undefined` for
  void-returning actions, but two call sites (`upsertSubscriptionPlan`,
  `createPlatformInvoice`) actually return data and needed an explicit
  `asSuperAdmin<{ planId: string }>` / `<{ invoiceId: string }>` generic
  rather than inferring `undefined` from the shared default
- **Verified**: `npm install`, `tsc --noEmit` (clean), `vitest run` (24/24
  still passing — unaffected by this module), full `next build` — all 62
  routes compile and prerender, including the 7 new `/dashboard/platform/*`
  routes and the newly-unorphaned `/dashboard/owner/settings`

## ✅ Part 13 — Multi-Branch + Realtime Chat (DONE — see verification note below)
- Migration `0020_multi_branch_chat.sql`: two additive columns on `gyms`
  (`manager_id`, `monthly_revenue_target`); `switch_active_branch()`,
  `tenant_branch_comparison()`, `tenant_combined_overview()` for multi-branch;
  `chat_channels`/`chat_channel_members`/`chat_messages`,
  `get_or_create_direct_channel()`, `create_broadcast_channel()`, a
  `chat_channels_overview` view, full RLS, and `chat_messages` added to the
  `supabase_realtime` publication for live delivery
- **Design choice**: rather than rewriting the ~105 RLS policy references to
  `current_gym_id()` across 10 existing migration files, multi-branch is
  built as **branch switching** — a gym owner's own `profiles.gym_id`
  becomes swappable between branches they own (already legal under the
  Part 1 self-update RLS policy). Every existing module in Parts 3–12
  automatically becomes branch-aware with zero changes, since they already
  key off the acting user's own `gym_id`. Combined analytics across
  branches is handled separately via new tenant-scoped SECURITY DEFINER
  functions that deliberately bypass that same single-branch scoping
- Server Actions: `lib/actions/branches.actions.ts` (branch CRUD, switching,
  combined analytics), `lib/actions/chat.actions.ts` (channels, direct/
  broadcast chat, messages, read receipts), `lib/actions/staff.actions.ts`
  (trainer/receptionist creation — closes the `/dashboard/owner/trainers`
  link that had been orphaned in the sidebar since Part 1, reusing Part 3's
  automatic-account-creation pattern)
- UI: branch switcher (topbar), `/dashboard/owner/branches`,
  `/dashboard/owner/trainers`, and a shared realtime `ChatShell` wired into
  `/dashboard/owner/chat`, `/dashboard/trainer/chat`, `/dashboard/member/chat`
  — channel list with unread counts, realtime thread (Supabase Realtime
  Postgres-changes subscription, no polling), and attachments (image/voice/
  PDF via an extended Cloudinary signed-upload flow)
- **Caught by manual review** (see verification note): `chat_channels_overview`
  initially had no filter on the viewing user and would have returned one
  row per channel *member* instead of per channel — fixed by filtering
  `where m.profile_id = auth.uid()` directly in the view. Also added missing
  `branchFormSchema.safeParse()` validation to `createBranch`/`updateBranch`
  so numeric form fields get coerced correctly instead of arriving as raw
  strings
- **✅ Verification update (Part 14)**: this part originally shipped with no
  network access, so the usual `npm install` → `tsc --noEmit` → `next build`
  pass could not be run and it was flagged unverified. That check has now
  been run for real (see Part 14 below) — it found and fixed one real bug
  (`chat-shell.tsx` unsafe array indexing) and everything now passes cleanly.

## ✅ Part 14 — Final Pass: Seed Data, Deployment Guide, Test Coverage, Hardening (DONE)
- **Ran the real verification Part 13 was missing**: this session had
  network access, so `npm install` → `tsc --noEmit` → `vitest run` →
  `next build` were actually run against Part 13's code for the first time.
  Found and fixed one real bug (`components/features/chat/chat-shell.tsx`
  indexed `res.data[0].channel_id` after only checking `.length > 0`, which
  doesn't narrow under `noUncheckedIndexedAccess` — fixed with `res.data[0]?.channel_id ?? null`).
  Part 13's verification caveat is resolved.
- **Seed script** (`supabase/seed/run.ts`, `npm run db:seed`): populates a
  realistic two-branch demo tenant ("Momentum Fitness") using the real
  production code paths — `admin.auth.admin.createUser()` for every account
  (so the Part 1 `handle_new_auth_user` trigger fires for real, not a
  shortcut insert), the actual `next_invoice_number()`/`next_receipt_number()`
  SQL functions for payments, inventory stock set via the transactions
  ledger (never written directly, per the Part 9 design). 1 owner, 1
  receptionist, 3 trainers, 25 members deliberately spread across active/
  expiring-soon/expired/frozen states, 30 days of attendance, workout/diet
  plans + progress for 10 members, a 12-lead CRM pipeline, 10 inventory
  items, 1 support ticket. Idempotent — checks for an existing `gymos-demo`
  tenant slug before creating anything.
- **Closed a real spec gap found by re-reading the requirements**: the
  "Fitness Calculator" (BMI/BMR/Maintenance Calories/Protein-Fat-Carbs/Goal
  Prediction) was explicitly in the original spec and `lib/utils/fitness.ts`
  was even flagged back in Part 6 as "the seed for the standalone Fitness
  Calculator feature later" — but it was never built. Added `bmiCategory`,
  `calculateBmr` (Mifflin-St Jeor), `calculateMaintenanceCalories`,
  `calculateGoalCalories`, `calculateMacros` (protein anchored to bodyweight
  in g/kg, fat at 25% of calories, carbs as remainder), and
  `predictGoalTimeline` (~7700 kcal/kg estimate) to `lib/utils/fitness.ts`,
  plus a new interactive member-facing page at
  `/dashboard/member/fitness-calculator` (client-side, pre-filled from the
  member's own stored stats), wired into the member sidebar.
- **Test coverage**: three new suites alongside Part 10's original 24 —
  `tests/unit/fitness.test.ts` (29 tests, with hand-computed expected values
  in the comments so a regression is caught against real numbers),
  `tests/unit/geo.test.ts` (5 tests, checked against real-world known
  distances including the seed script's own branch coordinates),
  `tests/unit/qr-token.test.ts` (10 tests on the Part 5 rotating-QR security
  scheme — cross-gym isolation, tamper resistance, replay/clock-skew
  behavior using Vitest's fake timers for precise control). **68 tests
  total, all passing.**
- **Documentation**: `README.md` (new, project root — stack, structure,
  roles, env vars, database/migrations, demo data, testing, deployment,
  with links out) and `docs/DEPLOYMENT.md` (new — step-by-step Supabase/
  Cloudinary/Resend/Twilio/Vercel setup, with an explicit table of all four
  cron-scheduling migrations that need `<PROJECT_REF>`/`<CRON_SECRET>`
  filled in before their scheduled Edge Functions actually fire, plus a
  post-deploy checklist).
- **Verified**: `npm install`, `tsc --noEmit` (clean — including the new
  seed script and fitness calculator, both inside the TypeScript project),
  `vitest run` (68/68 passing), full `next build` — all 68 routes compile
  and prerender, including the new `/dashboard/member/fitness-calculator`.

---
**Rule for every future part:** no TODOs, no placeholder pages, real RLS,
real Server Actions, and this file gets updated before moving on.
