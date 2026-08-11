# Part 11 — Reports & Analytics

## What's included

### Migration `0018_reports_analytics.sql`
- `expenses` table — a manual ledger (category, description, amount, vendor,
  date) used for the Profit & Loss report. RLS-gated to gym-owner only via
  the `reports`/`expenses` permission-matrix rows added in the same migration
  — this is the module's explicit enforcement of the spec's "receptionist
  cannot view revenue reports" restriction.
- Read-only SQL functions, one per report, each scoped by `p_gym_id` and (for
  time-series reports) an explicit `[p_start, p_end]` window so nothing ever
  silently defaults to "all time":
  - `report_revenue` — daily gross/GST/refunds/net + transaction count
  - `report_membership_summary` — active/expired counts and revenue by plan
  - `report_attendance` — daily check-ins, unique members, avg. duration
  - `report_trainer_performance` — active clients, revenue attributed via
    `member_memberships.trainer_id`, workout/diet plans authored, avg. client
    check-ins
  - `report_inventory` — stock value, low-stock flag, units sold in range
  - `report_payments_by_method` — reconciliation breakdown by payment method
  - `report_profit_loss` — monthly revenue vs. **manual expenses + finalized/
    paid payroll net pay**, so payroll isn't double-booked against a separate
    manual "salaries" line unless one is deliberately also logged
  - `analytics_growth` — new vs. churned members per month
  - `analytics_renewal_rate` — expiring memberships vs. renewed within 14 days
  - `analytics_retention` — 6-month joining-cohort retention

None of these invent numbers — they're straight aggregations over data
Parts 1–10 already capture. The one place this module deliberately reuses
rather than recomputes: the "Forecast" panel in Analytics links to and
displays the same `revenue_forecasts` row Part 8's AI Insights already
produces via real linear regression, instead of building a second forecaster.

### Server Actions (`lib/actions/reports.actions.ts`)
One function per report/analytics query, all permission-checked via
`requirePermission("reports", "read")`, plus full expense CRUD
(`createExpense` / `updateExpense` / `deleteExpense` / `listExpenses`) gated
on the `expenses` resource, and `getReportsSummary()` for the dashboard's
top-line KPI cards (derived from the same P&L/attendance queries, not
recomputed separately, so the header never disagrees with the tabs).

### UI
`/dashboard/owner/reports` — a 9-tab dashboard (Revenue, Membership,
Attendance, Trainer Performance, Inventory, Payments, Expenses, Profit &
Loss, Analytics) sharing one date-range picker (with This month / Last month
/ Last 90 days / Last 12 months presets). Every tab has **PDF and Excel
export** buttons that run entirely client-side against the already-fetched
rows (`jspdf` + `jspdf-autotable`, `xlsx` — both already project
dependencies, no new packages needed). `/dashboard/owner/revenue` — the nav
link left over from before this module existed — now redirects into Reports
(Revenue is its default tab).

Receptionist has no Reports link in the sidebar (matching the original spec)
and, even navigating directly, every report action fails its
`has_permission` check and returns an empty result with a friendly message
rather than exposing revenue data.

### Analytics vs. Reports
"Reports" tabs are raw, exportable data tables for record-keeping /
reconciliation. "Analytics" is the interpretive layer — retention, growth,
renewal rate, and a link into the existing AI-driven forecast — matching the
spec's separate "REPORTS" and "ANALYTICS" sections without duplicating the
forecasting logic Part 8 already built correctly.

**Verified**: `npm install`, `tsc --noEmit` (clean), `vitest run` (24/24
still passing), full `next build` — all 56 routes compile and prerender.
