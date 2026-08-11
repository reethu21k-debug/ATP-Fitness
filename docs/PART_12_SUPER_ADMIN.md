# Part 12 — Super Admin Console

## What this part adds

A platform-level control surface for the `super_admin` role — the one role
that sits above every tenant. Everything in this module manages the SaaS
business itself (who's paying, who's suspended, what features are rolled
out to whom, and support triage), not any single gym's data.

## Database

`supabase/migrations/0019_super_admin_console.sql`

| Table | Purpose |
|---|---|
| `subscription_plans` | The platform's own pricing catalog (trial/starter/growth/enterprise). Not to be confused with a gym's `membership_plans`, which is what a gym sells to *its* members. |
| `platform_invoices` | SaaS billing issued by the platform *to* a tenant. Manually recorded/marked-paid — no live payment gateway in this part. |
| `feature_flag_catalog` | A named, described registry of feature flags with a platform-wide default. The actual per-tenant override still lives in `tenants.feature_flags` (added in Part 1) — this table just makes that jsonb column discoverable and toggleable from a real UI instead of hand-typed keys. |
| `platform_settings` | A singleton row (`id boolean primary key default true`) for global config — platform name, support email, default trial length, maintenance mode. |
| `support_ticket_messages` | Threaded replies on the existing `support_tickets` table (from Part 1), with an `is_internal_note` flag visible only to super admins. |
| `tenant_admin_actions` | A dedicated audit log for suspend/reactivate/plan-change/flag-toggle — kept separate from any generic audit trail so the platform's most sensitive powers are always independently queryable. |

Plus a `tenants_overview` view (tenant + owner contact info + gym/member
counts) for the Tenants table UI, and these functions:

- `suspend_tenant(tenant_id, reason)` / `reactivate_tenant(tenant_id)` —
  server-authoritative; each writes its own `tenant_admin_actions` row
  atomically, so suspension state and its audit trail can never drift apart.
- `platform_overview_stats()` — tenant counts by subscription status, total
  gyms/members platform-wide, and MRR computed live from
  `subscription_plans.monthly_price × active tenants` (never a stored,
  staleable number).
- `platform_tenant_growth(start, end)` — month-by-month new + cumulative
  tenant counts for the growth chart.
- `tenant_usage_summary(tenant_id)` — gyms, staff, members, active members,
  and total revenue for one tenant.
- `platform_ticket_stats()` — open/in-progress/resolved/closed counts plus
  urgent-and-open count for the overview dashboard.

### RLS

Every table is super-admin-only by default (`is_super_admin()`), with three
narrow exceptions so a tenant can see (never write) its own data:

- A gym owner can `select` their own tenant's `platform_invoices`.
- A tenant's staff can `select`/`insert` non-internal
  `support_ticket_messages` on their own tenant's tickets — RLS itself
  blocks `is_internal_note = true` rows from ever reaching a non-admin
  query, so the tenant-side Server Actions don't need to trust a client
  filter to keep internal notes private.
- `subscription_plans` and `feature_flag_catalog` are readable by anyone
  authenticated (a pricing page or a tenant's own settings screen may want
  to show what a flag means), writable only by `is_super_admin()`.

## Server Actions

`lib/actions/platform.actions.ts`

Nearly every export is gated by a shared `asSuperAdmin<T>()` wrapper that
turns a thrown `PermissionError` into the same `{ success: false, error }`
shape every other module returns, so call sites never need their own
try/catch. The **tenant-side** exports at the bottom of the file
(`createSupportTicket`, `listMyTenantTickets`, `getMyTicketWithMessages`,
`replyToMyTicket`) are the deliberate exception — they're scoped by RLS to
the caller's own `tenant_id`, not gated by `requireRole("super_admin")`,
because a gym owner raising a ticket about their own account is exactly the
intended caller.

## UI

| Route | What's there |
|---|---|
| `/dashboard/platform` | Overview: MRR, tenant/gym/member stat cards, 12-month tenant growth chart (cumulative or new-per-month), support ticket status summary. |
| `/dashboard/platform/tenants` | Searchable, sortable, paginated tenant table (TanStack Table + TanStack Query, same pattern as the Members module). |
| `/dashboard/platform/tenants/[id]` | Usage stats, suspend/reactivate (suspend requires a logged reason), plan-change dropdown, per-tenant feature-flag toggles (showing which are overridden vs. defaulted), white-label branding form (domain/logo/color), and the full admin-action history for that tenant. |
| `/dashboard/platform/billing` | Tabbed: **Subscription Plans** (create/edit/deactivate platform pricing tiers) and **Invoices** (create/list/mark-paid/void SaaS invoices per tenant). |
| `/dashboard/platform/tickets` → `/[id]` | Filterable ticket list → threaded detail view with reply box, an internal-note checkbox, and inline status/priority controls. |
| `/dashboard/platform/settings` | Platform-wide config form (name, support email, trial length, maintenance mode/message, registration toggle) and the feature flag catalog editor. |
| `/dashboard/owner/settings` | **New on the tenant side.** This nav link existed since early parts but had no page behind it. It now hosts a subscription/billing-status card (reads the same `subscription_plans` + `tenants` data the platform side manages) and a support-ticket panel — raise a ticket, see status/priority, and reply in a thread — reusing the exact badge components from the platform UI so both sides of a ticket look identical. |

## Design choices worth flagging

**Feature flags are intentionally two layers.** The catalog table
(`feature_flag_catalog`) defines what a flag *means* and its platform
default. The actual per-tenant on/off state is still the
`tenants.feature_flags` jsonb column from Part 1 — nothing about how the
rest of the app reads a flag needed to change; the catalog just makes flags
discoverable and toggleable instead of requiring hand-typed JSON keys.

**Suspension is server-authoritative.** `suspend_tenant()` is a
`security definer` SQL function, not a client-side `UPDATE`, and it writes
its own audit row in the same transaction. There's no path to suspending a
tenant without that action being logged.

**MRR is computed, not stored.** `platform_overview_stats()` joins active
tenants against `subscription_plans.monthly_price` live on every call — if
a plan's price changes, MRR reflects it immediately rather than requiring a
backfill job.

## Verified

`npm install` → `tsc --noEmit` (clean) → `vitest run` (24/24, unaffected by
this module) → `next build` (all 62 routes compile and prerender, including
the 7 new `/dashboard/platform/*` routes and the newly-unorphaned
`/dashboard/owner/settings`).

## Next

Part 13 — Multi-branch + Realtime Chat.
