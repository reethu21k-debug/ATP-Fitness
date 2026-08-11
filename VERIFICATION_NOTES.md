# Independent Verification Notes

This is a record of the verification pass run against the uploaded project,
separate from the project's own `BUILD_STATUS.md` (which documents what was
built, part by part, during original development). This file documents what
was independently re-checked and what was actually found and fixed.

## What was run

1. `npm install` — clean install, 713 packages, no unresolved errors.
2. `npx tsc --noEmit` — **0 type errors**.
3. `npx vitest run` — **68/68 tests passing** (fitness calculator, marketing
   helpers, geo/haversine distance, rotating QR token security).
4. `npx next build` — **all 68 routes compile and prerender successfully.**
5. Beyond what the project's own docs claimed: stood up a real local
   PostgreSQL 16 instance and applied **all 20 SQL migrations in order**
   against it, with Supabase-managed infrastructure (`auth.uid()`, the
   `authenticated`/`anon`/`service_role` roles, `pg_cron`, `pg_net`, the
   `supabase_realtime` publication) stubbed in locally, since those only
   exist on an actual Supabase project. Result: **all migrations apply
   cleanly** — 54 tables, 10 views, 89 functions, 128 RLS policies, 29
   triggers, and **RLS is enabled on all 54 tables with zero exceptions**.
6. Searched the full app/components/lib tree for `TODO`, `FIXME`,
   "placeholder page", "not implemented" — **none found**, consistent with
   the project's "no TODOs, no placeholder pages" rule.
7. Manually reviewed all 5 Supabase Edge Functions for the shared-secret
   auth check, idempotency logging, and Resend/Twilio call correctness.

## Bug found and fixed

**`lib/services/whatsapp.ts` — Twilio client crashed the production build.**

The Twilio client was constructed eagerly at module scope:

```ts
const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;
```

Twilio's SDK constructor throws **synchronously** if `TWILIO_ACCOUNT_SID`
isn't in its exact `AC...`-prefixed format — even when both env vars are
non-empty (e.g. a placeholder value in a preview/staging environment, or a
typo in the real one). Because this module is imported by a server
component (`/dashboard/owner/members/[id]`), that thrown error propagated
all the way up and **failed the entire `next build`** during Next.js's
page-data collection step — not a lint warning, a hard build failure.

Fixed by making client construction lazy (on first send attempt, not at
import time) and validating the `AC`-prefix shape before calling the SDK
constructor, with a `try/catch` as a second line of defense. Behavior for
correctly-configured credentials is unchanged; a misconfigured/placeholder
value now logs a warning and disables WhatsApp sending instead of crashing
anything that imports the module.

## Bug 2 (found in a follow-up pass): AI analytics actions missing role checks

**`lib/actions/ai.actions.ts` — four functions skipped the codebase's own
authorization convention.**

Every "owner-only" action elsewhere in the codebase (payments, marketing,
payroll, branches, staff, member deletion, etc.) starts with
`await requireRole("gym_owner", "super_admin")`. Four functions in this
file didn't:

- `generateWorkoutPlanAI` / `generateDietPlanAI` had **no auth check at
  all** — callable by anyone, unauthenticated, since Next.js Server Actions
  are network-reachable endpoints regardless of which page renders the
  button that calls them. This meant an anonymous visitor could repeatedly
  invoke them and consume your Anthropic API quota/billing with no login
  required.
- `computeRiskScores` / `getRiskScores` / `computeRevenueForecast` /
  `getLatestForecast` checked `getCurrentProfile()` (i.e. "is *someone*
  logged in with a gym_id") but not *role*. Since these functions look up
  data by `gym_id` rather than by the caller's own profile id, any signed-in
  **member or trainer** at a gym — not just the owner — could call them
  directly and see every other member's cancellation-risk score and the
  gym's full revenue forecast. The spec explicitly treats revenue as
  owner-only (it's the first thing listed as off-limits for receptionists).

Fixed by adding `requireRole("gym_owner", "super_admin")` to the four
gym-analytics functions (matching the file's own `computeRiskScores`
pattern used everywhere else in the codebase) and a plain "must be signed
in" check to the two AI-generator functions, which are intentionally
member/trainer-usable but were missing even that baseline. Re-ran
`tsc --noEmit`, the full test suite, and `next build` after this change —
all still pass (0 type errors, 68/68 tests, 68/68 routes build).


- The `next build` also initially failed trying to fetch the `Inter` font
  from Google Fonts — this is an artifact of this verification sandbox
  having no outbound access to `fonts.googleapis.com`, not a code issue.
  Vercel's own build servers can reach Google Fonts normally; no code
  change was needed or made here.
- `lib/services/email.ts` (Resend) and `lib/services/cloudinary.ts` use the
  same "only initialize if the env var is present" pattern, but neither the
  Resend SDK constructor nor `cloudinary.config()` validates key *format* at
  construction time the way Twilio does, so they don't share this failure
  mode.

## Scope note

This pass verified the project mechanically compiles, type-checks, tests
pass, and the full SQL schema (tables/views/functions/triggers/RLS) applies
correctly end-to-end. It is not a substitute for testing against a real
Supabase project with real Cloudinary/Resend/Twilio/Anthropic credentials
and real user flows through the UI (login, payments, chat, etc.) — that
requires live third-party accounts this environment doesn't have access to.
The `docs/DEPLOYMENT.md` guide walks through exactly that setup.
