# Part 14 — Final Pass: Seed Data, Deployment Guide, Test Coverage, Hardening

## What this part adds

Part 14 is not a new feature module — it's the pass every real project needs
before calling something "done": realistic demo data so the app isn't empty
on first login, a deployment guide precise enough to actually follow, wider
automated test coverage on the parts of the codebase where a silent bug would
be expensive, and a hardening pass that closes gaps found by re-reading the
whole project rather than building forward.

## Verifying Part 13 for real

Part 13 shipped with an explicit caveat in `BUILD_STATUS.md`: the sandbox
that built it had no network access, so `npm install` → `tsc --noEmit` →
`next build` — the exact verification loop every other part passed — could
not be run, and the part was flagged as "unverified" pending that check.

This session had network access, so that check finally happened for real:

- `npm install` — succeeded (713 packages)
- `tsc --noEmit` — found **one real bug**: `components/features/chat/chat-shell.tsx`
  indexed `res.data[0].channel_id` after checking `res.data.length > 0`, which
  doesn't narrow array access under `noUncheckedIndexedAccess`. Fixed with
  `res.data[0]?.channel_id ?? null` — a one-line fix, but exactly the kind of
  thing that only surfaces when the compiler is actually run, not just
  reasoned about.
- `vitest run` — 24/24 passing (unaffected)
- `next build` — all 67 routes compiled and prerendered clean

Part 13's verification caveat is now resolved.

## Seed script (`supabase/seed/run.ts`)

`npm run db:seed` populates one realistic tenant, "Momentum Fitness," across
two branches (Koramangala + Indiranagar — exercising the Part 13 multi-branch
model for real, not just schema-deep). Deliberately built to mirror the
**actual production code paths**, not a shortcut:

- Auth users are created via `admin.auth.admin.createUser(...)`, exactly the
  way `createMember`/`registerGym`/`createStaff` do it in the real Server
  Actions — so the `handle_new_auth_user` trigger fires for real and every
  profile row is created the same way live traffic creates it, not inserted
  directly into `profiles` as a shortcut that could drift from reality.
- Payments use the actual `next_invoice_number()`/`next_receipt_number()` SQL
  functions from Part 4 — gapless numbering exercised for real, not faked
  with `INV-${i}` strings (those only appear as a fallback if the RPC call
  itself fails).
- Inventory stock is set via `inventory_transactions` inserts, never by
  writing `quantity` directly — respecting the Part 9 design where quantity
  is a derived value driven entirely by the transaction ledger.
- Membership state is deliberately distributed (15 active, 4 expiring within
  a week, 4 recently expired, 2 frozen) so every dashboard, report, and
  renewal-reminder code path has real data to exercise immediately, instead
  of a uniform "25 active members" dataset that would make half the app look
  unused.
- Idempotency: checks for an existing tenant with slug `gymos-demo` first and
  exits cleanly instead of creating duplicate auth users on a second run.

Covers: 1 owner, 1 receptionist, 3 trainers, 25 members (with member_details,
memberships, payments), 30 days of attendance history, workout/diet plans +
progress history for 10 members, 12 CRM leads across the full pipeline, 10
inventory items with real stock transactions, and 1 support ticket.

## Closing a real spec gap: the Fitness Calculator

Re-reading the original spec against the actual codebase surfaced a genuine
gap: **"Fitness Calculator" (BMI, BMR, Maintenance Calories, Protein/Fat/
Carbs, Goal Prediction)** was explicitly listed as its own member-facing
feature, and `BUILD_STATUS.md` even noted `lib/utils/fitness.ts` as "the seed
for the standalone Fitness Calculator feature later" back in Part 6 — but
"later" never happened. Only a bare `calculateBmi` function existed; nothing
else in the list was built, and there was no calculator page anywhere in the
app.

Part 14 closes this:

- `lib/utils/fitness.ts` gained `bmiCategory` (WHO bands), `calculateBmr`
  (Mifflin-St Jeor equation — the modern standard, more accurate across a
  broad population than Harris-Benedict), `calculateMaintenanceCalories`
  (activity-level multipliers), `calculateGoalCalories` (±20%/+15% adjustment
  for lose/maintain/gain), `calculateMacros` (protein anchored to bodyweight
  in g/kg — the evidence-based approach, not a flat % of calories — fat at
  25% of total calories, carbs as the remainder), and `predictGoalTimeline`
  (using the standard ~7700 kcal-per-kg-of-fat estimate, explicitly framed as
  a rough planning estimate, not a medical prediction).
- A new member-facing page at `/dashboard/member/fitness-calculator`,
  interactive and fully client-side (it's pure math — no server round-trip
  needed), pre-filled from the member's own stored height/weight/gender so
  it's a genuinely useful one-click check, not a blank form.
- Added to the member sidebar nav, closing what was — as far as a full
  re-read of the spec against the shipped app could find — the last
  unbuilt top-level feature from the original requirements.

## Test coverage additions

The project's first test suite (Part 10, 24 tests on marketing helpers) is
now joined by three more suites, chosen specifically for **pure logic where a
silent bug would be expensive or hard to notice**, not for coverage-percentage
theater:

- **`tests/unit/fitness.test.ts`** (29 tests) — every new fitness formula,
  including hand-computed expected values in the test comments themselves
  (e.g. the exact Mifflin-St Jeor arithmetic), so a future regression is
  caught against real numbers, not just "does the function still return
  something."
- **`tests/unit/geo.test.ts`** (5 tests) — the haversine distance function
  used to gate GPS-verified attendance check-ins, tested against real-world
  known distances (the seed script's own two branch coordinates, ~4.9km
  apart; a rough Delhi–Mumbai distance, ~1,150km) rather than only synthetic
  values, plus a symmetry check.
- **`tests/unit/qr-token.test.ts`** (10 tests) — the HMAC-based rotating
  attendance QR scheme from Part 5, which is a real security boundary: tests
  cover cross-gym isolation (a token for gym A must not verify for gym B),
  tamper resistance (flipping one character fails), replay/clock-manipulation
  resistance (a bucket from the future or too far in the past is rejected),
  and that the documented one-window clock-skew tolerance actually works
  (using `vitest`'s fake timers to control the clock precisely rather than
  relying on real elapsed time in a test).

Total: **68 tests, 4 files, all passing** — verified via `vitest run`, not
just written and assumed correct.

## Documentation

- **`README.md`** (new, project root) — stack, structure, roles, environment
  variables, database/migrations, demo data, testing, and deployment, with
  links out to the deeper docs. Previously the only root-level doc was
  `BUILD_STATUS.md`, which is a build log, not an onboarding doc — a new
  contributor had nowhere to start.
- **`docs/DEPLOYMENT.md`** (new) — a genuinely followable, step-by-step
  deployment guide: Supabase project setup, applying all 20 migrations,
  **explicitly listing all four cron-scheduling migrations that contain
  `<PROJECT_REF>`/`<CRON_SECRET>` placeholders** (with their exact schedules
  and target functions in a table, so nothing has to be re-derived from
  reading migration SQL), deploying the 5 Edge Functions with their own
  separate secrets, Cloudinary/Resend/Twilio account setup, optional
  Google/Apple OAuth wiring, Vercel deployment, and a concrete post-deploy
  checklist.

## Verification

`npm install` → `tsc --noEmit` (clean, including the seed script and new
fitness calculator component — both are inside the TypeScript project, not
excluded) → `vitest run` (68/68 passing) → `next build` (all 68 routes,
including the new `/dashboard/member/fitness-calculator`, compile and
prerender clean).
