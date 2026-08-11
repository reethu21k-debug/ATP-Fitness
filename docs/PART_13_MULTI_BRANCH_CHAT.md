# Part 13 — Multi-Branch + Realtime Chat

## What this part adds

Two previously-orphaned or missing capabilities: a gym owner running more
than one location, and the real-time chat promised in the original spec
(Trainer ↔ Member, Admin ↔ Trainer, Broadcast, with attachments).

## Design decision: how multi-branch actually works

The `tenants` → `gyms` relationship has been one-to-many since Part 1 (a
tenant, i.e. an owner account, can already own several `gyms`/branches). What
never existed was a way to *use* that: every Server Action and RLS policy
written in Parts 3–12 scopes its reads/writes through the **acting user's own
`profiles.gym_id`** (roughly 105 separate RLS policy references to the
`current_gym_id()` helper, plus the same pattern in every Server Action —
`const actor = await getCurrentProfile(); ... .eq("gym_id", actor.gym_id)`).

Rewriting that entire surface to understand "one owner, many branches" would
have meant touching 10 existing migration files and every module in the app —
high risk, for a codebase that already works. Instead, Part 13 makes the
**gym owner's own `gym_id` switchable**:

- `switch_active_branch(gym_id)` — a SECURITY DEFINER SQL function — verifies
  the target branch belongs to the caller's own tenant, then updates the
  caller's own `profiles.gym_id`. This was already legal under the Part 1
  `profiles_update` RLS policy (`id = auth.uid()`); the function is the real
  authority, never a client-supplied value alone.
- The instant an owner switches branches, **every existing table, action, and
  RLS policy in the app automatically operates on the new branch** — members,
  payments, attendance, inventory, payroll, marketing, reports, chat — with
  zero code changes to Parts 3–12.
- "Separate data per branch" was already true by construction. What was
  missing was (a) a UI to create/manage branches (the `gyms` table's own
  insert/update RLS was *already* tenant-scoped, not gym-scoped — so this
  always worked, there was just no page for it), (b) a switcher, and (c)
  **combined analytics**, which by definition must deliberately bypass the
  single-branch scoping — done via new SECURITY DEFINER functions that
  explicitly aggregate across every gym in the caller's own tenant.

## Database

`supabase/migrations/0020_multi_branch_chat.sql`

**Branches** — additive columns only:
| Column added to `gyms` | Purpose |
|---|---|
| `manager_id` | Optional staff member designated as this branch's manager. |
| `monthly_revenue_target` | Optional target, shown against actual on the branch card. |

**Functions:**
- `switch_active_branch(gym_id)` — see above.
- `tenant_branch_comparison(start, end)` — per-branch member/staff counts,
  revenue, attendance, and new-member counts for a date range. `gym_owner`/
  `super_admin` only, and only across the caller's own tenant.
- `tenant_combined_overview()` — tenant-wide KPIs (total/active gyms,
  members, staff, this-month vs. last-month revenue) rolled up across every
  branch in one call.

**Chat:**
| Table | Purpose |
|---|---|
| `chat_channels` | Either `direct` (two people) or `broadcast` (one sender, many recipients). |
| `chat_channel_members` | Who's in a channel, whether they `can_send`, and `last_read_at` for unread counts. |
| `chat_messages` | Text and/or one attachment (image / voice / pdf) per message. |

- `get_or_create_direct_channel(other_profile_id)` — the pairing rules are
  enforced **inside this SECURITY DEFINER function**, not just in the UI:
  member↔their assigned trainer, gym_owner↔any trainer/receptionist in their
  tenant, super_admin↔gym_owner. A deterministic sorted `direct_key`
  (`least(id)_greatest(id)`) means calling it twice for the same pair always
  resumes the same channel rather than creating duplicates.
- `create_broadcast_channel(name, audience)` — gym_owner only, scoped to
  their currently-active branch; adds every matching profile as a read-only
  (`can_send = false`) member in one insert.
- `chat_channels_overview` — a view joining channels to the *querying user's
  own* membership row (deliberately filtered `where m.profile_id =
  auth.uid()` inside the view definition itself, not left to the caller — a
  plain join without that filter would return one row per channel *member*,
  not per channel, since RLS on `chat_channel_members` legitimately allows
  seeing co-members too). Computes `unread_count` and `last_message_preview`
  inline so the channel list needs exactly one query.
- Realtime is enabled via `alter publication supabase_realtime add table
  chat_messages` — the client subscribes to Postgres change events directly,
  no polling and no extra delivery infrastructure.

### RLS
Channels/messages/membership are all scoped to "am I a member of this
channel" — with **no direct insert policy for channels** at all. Channels can
only ever be created through the two SECURITY DEFINER functions above, which
enforce the real pairing/audience rules server-side and bypass RLS by
definition; there is no path for a client to insert an arbitrary channel row
directly.

## Server Actions

- `lib/actions/branches.actions.ts` — branch CRUD, `switchActiveBranch`,
  `getBranchComparison`, `getTenantCombinedOverview`.
- `lib/actions/chat.actions.ts` — `listMyChannels`, `listChatableContacts`
  (role-aware: a member sees their trainer, a trainer sees their clients +
  owner, an owner sees their branch's staff), `startDirectChat`,
  `createBroadcast`, `listChannelMessages`, `sendChatMessage`,
  `markChannelRead`.
- `lib/actions/staff.actions.ts` — closes the `/dashboard/owner/trainers`
  link that had been orphaned in the sidebar since Part 1. `createStaffMember`
  reuses the exact "automatic account creation" pattern from Part 3's
  `createMember` (random password, forced reset, welcome email + WhatsApp),
  scoped to the owner's currently-active branch.

## UI

- **Branch switcher** in the topbar (gym_owner only; hidden entirely for a
  single-branch tenant — nothing to switch between yet).
- `/dashboard/owner/branches` — combined KPIs, a revenue-by-branch chart,
  and branch cards (create/edit/activate/deactivate).
- `/dashboard/owner/trainers` — trainer/receptionist management for the
  active branch.
- `/dashboard/owner/chat`, `/dashboard/trainer/chat`, `/dashboard/member/chat`
  — a shared `ChatShell` component: channel list with unread badges, a
  realtime thread view, and a composer supporting text plus one image/voice/
  PDF attachment per message (uploaded direct-to-Cloudinary via the same
  signed-upload pattern as member photos, extended to accept `resourceType`
  for audio/raw files). Only the gym owner's chat page can start a broadcast.

## A bug caught during review, not by the compiler

This sandbox had no network access this session, so `npm install`/`tsc`/
`next build` could not be run here the way every previous part verified
itself — that gap is called out explicitly rather than glossed over. In its
place: every column referenced in the new migration and Server Actions was
manually cross-checked against the actual schema, and one real bug was found
this way — `chat_channels_overview` initially joined `chat_channels` to
`chat_channel_members` with no filter on the viewing user, which under RLS
would have returned one row per channel *member* (e.g. 50 rows for a
50-person broadcast) instead of one row per channel for the viewer. Fixed by
filtering `where m.profile_id = auth.uid()` directly in the view definition.
A second, smaller issue: `createBranch`/`updateBranch` initially skipped
`branchFormSchema.safeParse()`, meaning numeric fields from the form (radius,
revenue target) would have arrived as raw strings instead of being coerced
by `z.coerce.number()` — fixed to match the validate-then-use pattern every
other action in the codebase follows.

**Running `npm install && npx tsc --noEmit && npm run build` (and `npx vitest
run` for the existing suite) before deploying this part is required, not
optional** — treat it as an unverified diff until that's done.
