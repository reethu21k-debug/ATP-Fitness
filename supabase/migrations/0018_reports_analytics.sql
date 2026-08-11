-- ============================================================================
-- GymOS — Part 11: Reports & Analytics
-- Adds: expenses ledger (needed for Profit & Loss), plus reporting views/
-- functions that aggregate data already captured by Parts 1–10. Reports are
-- read-only rollups — no new "facts" are invented, they're derived straight
-- from payments, memberships, attendance, inventory, and payroll.
-- ============================================================================

create type public.expense_category as enum (
  'rent', 'utilities', 'salaries', 'equipment', 'marketing', 'maintenance', 'other'
);

-- ============================================================================
-- EXPENSES (manual ledger — payroll net_pay is pulled in separately for P&L
-- so staff salaries aren't double-entered here; category 'salaries' covers
-- anything paid outside the payroll module, e.g. a one-off contractor).
-- ============================================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  category public.expense_category not null default 'other',
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  vendor text,
  expense_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_gym_date on public.expenses(gym_id, expense_date desc);
create index idx_expenses_category on public.expenses(gym_id, category);

create trigger trg_expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy "expenses_select" on public.expenses for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id() and public.has_permission('reports','read')));
create policy "expenses_insert" on public.expenses for insert
  with check (public.is_super_admin() or (public.has_permission('expenses','create') and gym_id = public.current_gym_id()));
create policy "expenses_update" on public.expenses for update
  using (public.is_super_admin() or (public.has_permission('expenses','update') and gym_id = public.current_gym_id()));
create policy "expenses_delete" on public.expenses for delete
  using (public.is_super_admin() or (public.has_permission('expenses','delete') and gym_id = public.current_gym_id()));

-- ============================================================================
-- PERMISSION MATRIX — reports/expenses are gym-owner only. Matches the spec's
-- "Receptionist cannot view revenue reports" restriction explicitly.
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','reports','read',true),
  ('gym_owner','expenses','create',true),
  ('gym_owner','expenses','update',true),
  ('gym_owner','expenses','delete',true),
  ('receptionist','reports','read',false),
  ('receptionist','expenses','create',false),
  ('trainer','reports','read',false)
on conflict (role, resource, action) do nothing;

-- ============================================================================
-- REVENUE REPORT — daily net revenue (payments minus same-day refunds isn't
-- tracked per-day for refunds, so refunds are shown as their own column,
-- consistent with how Part 4 books them as separate rows, not reversals).
-- ============================================================================

create or replace function public.report_revenue(p_gym_id uuid, p_start date, p_end date)
returns table (
  day date,
  gross_amount numeric,
  gst_amount numeric,
  refund_amount numeric,
  net_amount numeric,
  transaction_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    d::date as day,
    coalesce(p.gross, 0) as gross_amount,
    coalesce(p.gst, 0) as gst_amount,
    coalesce(r.refunded, 0) as refund_amount,
    coalesce(p.gross, 0) - coalesce(r.refunded, 0) as net_amount,
    coalesce(p.cnt, 0) as transaction_count
  from generate_series(p_start, p_end, interval '1 day') d
  left join (
    select created_at::date as day, sum(total_amount) as gross, sum(gst_amount) as gst, count(*) as cnt
    from public.payments
    where gym_id = p_gym_id and created_at::date between p_start and p_end
    group by created_at::date
  ) p on p.day = d::date
  left join (
    select r.created_at::date as day, sum(r.amount) as refunded
    from public.refunds r
    where r.gym_id = p_gym_id and r.created_at::date between p_start and p_end
    group by r.created_at::date
  ) r on r.day = d::date
  order by d;
$$;

-- ============================================================================
-- MEMBERSHIP REPORT — active/expired/frozen counts and revenue by plan.
-- ============================================================================

create or replace function public.report_membership_summary(p_gym_id uuid)
returns table (
  plan_name text,
  active_count bigint,
  expired_count bigint,
  total_revenue numeric
)
language sql stable security definer set search_path = public
as $$
  select
    coalesce(mp.name, 'Custom / Deleted Plan') as plan_name,
    count(*) filter (where mm.is_current and mm.end_date >= current_date) as active_count,
    count(*) filter (where mm.end_date < current_date) as expired_count,
    coalesce(sum(mm.amount_paid), 0) as total_revenue
  from public.member_memberships mm
  left join public.membership_plans mp on mp.id = mm.plan_id
  where mm.gym_id = p_gym_id
  group by mp.name
  order by total_revenue desc;
$$;

-- ============================================================================
-- ATTENDANCE REPORT — daily check-ins, unique members, avg session duration.
-- ============================================================================

create or replace function public.report_attendance(p_gym_id uuid, p_start date, p_end date)
returns table (
  day date,
  check_ins bigint,
  unique_members bigint,
  avg_duration_minutes numeric
)
language sql stable security definer set search_path = public
as $$
  select
    d::date as day,
    coalesce(a.cnt, 0) as check_ins,
    coalesce(a.uniq, 0) as unique_members,
    coalesce(a.avg_dur, 0) as avg_duration_minutes
  from generate_series(p_start, p_end, interval '1 day') d
  left join (
    select check_in_at::date as day, count(*) as cnt, count(distinct member_id) as uniq,
           avg(duration_minutes) filter (where duration_minutes is not null) as avg_dur
    from public.attendance_records
    where gym_id = p_gym_id and check_in_at::date between p_start and p_end
    group by check_in_at::date
  ) a on a.day = d::date
  order by d;
$$;

-- ============================================================================
-- TRAINER PERFORMANCE — active clients, revenue attributed via memberships,
-- workout/diet plans authored, and average client attendance rate.
-- ============================================================================

create or replace function public.report_trainer_performance(p_gym_id uuid, p_start date, p_end date)
returns table (
  trainer_id uuid,
  trainer_name text,
  active_clients bigint,
  revenue_generated numeric,
  workout_plans_created bigint,
  diet_plans_created bigint,
  avg_client_checkins numeric
)
language sql stable security definer set search_path = public
as $$
  select
    p.id as trainer_id,
    p.full_name as trainer_name,
    count(distinct md.profile_id) filter (where md.status = 'active') as active_clients,
    coalesce(sum(mm.amount_paid) filter (where mm.created_at::date between p_start and p_end), 0) as revenue_generated,
    count(distinct wp.id) filter (where wp.created_at::date between p_start and p_end) as workout_plans_created,
    count(distinct dp.id) filter (where dp.created_at::date between p_start and p_end) as diet_plans_created,
    coalesce((
      select avg(sub.cnt) from (
        select ar.member_id, count(*) as cnt
        from public.attendance_records ar
        join public.member_details md2 on md2.profile_id = ar.member_id
        where md2.assigned_trainer_id = p.id and ar.check_in_at::date between p_start and p_end
        group by ar.member_id
      ) sub
    ), 0) as avg_client_checkins
  from public.profiles p
  left join public.member_details md on md.assigned_trainer_id = p.id
  left join public.member_memberships mm on mm.trainer_id = p.id
  left join public.workout_plans wp on wp.trainer_id = p.id
  left join public.diet_plans dp on dp.trainer_id = p.id
  where p.gym_id = p_gym_id and p.role = 'trainer'
  group by p.id, p.full_name
  order by revenue_generated desc;
$$;

-- ============================================================================
-- INVENTORY REPORT — stock value, low-stock count, movement in range.
-- ============================================================================

create or replace function public.report_inventory(p_gym_id uuid, p_start date, p_end date)
returns table (
  item_id uuid,
  item_name text,
  category public.inventory_category,
  quantity int,
  stock_value numeric,
  units_sold_in_range bigint,
  is_low_stock boolean
)
language sql stable security definer set search_path = public
as $$
  select
    i.id as item_id,
    i.name as item_name,
    i.category,
    i.quantity,
    coalesce(i.quantity * i.cost_price, 0) as stock_value,
    coalesce((
      select sum(-t.quantity_change) from public.inventory_transactions t
      where t.item_id = i.id and t.type = 'sale' and t.created_at::date between p_start and p_end
    ), 0) as units_sold_in_range,
    i.quantity <= i.low_stock_threshold as is_low_stock
  from public.inventory_items i
  where i.gym_id = p_gym_id and i.is_active
  order by stock_value desc;
$$;

-- ============================================================================
-- PAYMENTS REPORT — breakdown by method, for reconciliation.
-- ============================================================================

create or replace function public.report_payments_by_method(p_gym_id uuid, p_start date, p_end date)
returns table (
  method public.payment_method,
  transaction_count bigint,
  total_amount numeric
)
language sql stable security definer set search_path = public
as $$
  select method, count(*) as transaction_count, sum(total_amount) as total_amount
  from public.payments
  where gym_id = p_gym_id and created_at::date between p_start and p_end
  group by method
  order by total_amount desc;
$$;

-- ============================================================================
-- PROFIT & LOSS — monthly revenue (net of refunds) vs. expenses (manual
-- ledger + finalized/paid payroll net pay, so payroll isn't double counted
-- against a separate "salaries" manual entry unless one is also logged).
-- ============================================================================

create or replace function public.report_profit_loss(p_gym_id uuid, p_start date, p_end date)
returns table (
  month date,
  revenue numeric,
  refunds numeric,
  manual_expenses numeric,
  payroll_expenses numeric,
  total_expenses numeric,
  profit numeric
)
language sql stable security definer set search_path = public
as $$
  select
    m::date as month,
    coalesce(rev.total, 0) as revenue,
    coalesce(rf.total, 0) as refunds,
    coalesce(exp.total, 0) as manual_expenses,
    coalesce(pay.total, 0) as payroll_expenses,
    coalesce(exp.total, 0) + coalesce(pay.total, 0) as total_expenses,
    coalesce(rev.total, 0) - coalesce(rf.total, 0) - coalesce(exp.total, 0) - coalesce(pay.total, 0) as profit
  from generate_series(date_trunc('month', p_start), date_trunc('month', p_end), interval '1 month') m
  left join (
    select date_trunc('month', created_at) as month, sum(total_amount) as total
    from public.payments where gym_id = p_gym_id
    group by 1
  ) rev on rev.month = m
  left join (
    select date_trunc('month', created_at) as month, sum(amount) as total
    from public.refunds where gym_id = p_gym_id
    group by 1
  ) rf on rf.month = m
  left join (
    select date_trunc('month', expense_date) as month, sum(amount) as total
    from public.expenses where gym_id = p_gym_id
    group by 1
  ) exp on exp.month = m
  left join (
    select month as month, sum(net_pay) as total
    from public.payslips where gym_id = p_gym_id and status in ('finalized','paid')
    group by 1
  ) pay on pay.month = m
  order by m;
$$;

-- ============================================================================
-- ANALYTICS — retention (still-active members from N months ago cohort),
-- growth (new vs. lost members per month), renewal rate (renewed vs. expired).
-- ============================================================================

create or replace function public.analytics_growth(p_gym_id uuid, p_start date, p_end date)
returns table (
  month date,
  new_members bigint,
  churned_members bigint,
  net_growth bigint,
  total_active_at_month_end bigint
)
language sql stable security definer set search_path = public
as $$
  select
    m::date as month,
    coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id and date_trunc('month', md.joining_date) = m
    ), 0) as new_members,
    coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id and md.status = 'cancelled'
        and date_trunc('month', md.updated_at) = m
    ), 0) as churned_members,
    coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id and date_trunc('month', md.joining_date) = m
    ), 0) - coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id and md.status = 'cancelled' and date_trunc('month', md.updated_at) = m
    ), 0) as net_growth,
    coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id and md.joining_date <= (m + interval '1 month' - interval '1 day')
        and (md.status <> 'cancelled' or md.updated_at > (m + interval '1 month' - interval '1 day'))
    ), 0) as total_active_at_month_end
  from generate_series(date_trunc('month', p_start), date_trunc('month', p_end), interval '1 month') m
  order by m;
$$;

create or replace function public.analytics_renewal_rate(p_gym_id uuid, p_start date, p_end date)
returns table (
  month date,
  expiring_count bigint,
  renewed_count bigint,
  renewal_rate numeric
)
language sql stable security definer set search_path = public
as $$
  with expiring as (
    select mm.id, mm.member_id, date_trunc('month', mm.end_date) as month
    from public.member_memberships mm
    where mm.gym_id = p_gym_id and mm.end_date between p_start and p_end
  )
  select
    e.month::date as month,
    count(*) as expiring_count,
    count(*) filter (
      where exists (
        select 1 from public.member_memberships mm2
        where mm2.member_id = e.member_id and mm2.start_date > (
          select end_date from public.member_memberships where id = e.id
        )
        and mm2.start_date <= (select end_date from public.member_memberships where id = e.id) + interval '14 days'
      )
    ) as renewed_count,
    round(
      100.0 * count(*) filter (
        where exists (
          select 1 from public.member_memberships mm2
          where mm2.member_id = e.member_id and mm2.start_date > (
            select end_date from public.member_memberships where id = e.id
          )
          and mm2.start_date <= (select end_date from public.member_memberships where id = e.id) + interval '14 days'
        )
      ) / nullif(count(*), 0), 1
    ) as renewal_rate
  from expiring e
  group by e.month
  order by e.month;
$$;

create or replace function public.analytics_retention(p_gym_id uuid)
returns table (
  cohort_months_ago int,
  cohort_size bigint,
  still_active bigint,
  retention_rate numeric
)
language sql stable security definer set search_path = public
as $$
  select
    n as cohort_months_ago,
    coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id
        and date_trunc('month', md.joining_date) = date_trunc('month', current_date) - (n || ' months')::interval
    ), 0) as cohort_size,
    coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id
        and date_trunc('month', md.joining_date) = date_trunc('month', current_date) - (n || ' months')::interval
        and md.status = 'active'
    ), 0) as still_active,
    round(100.0 * coalesce((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id
        and date_trunc('month', md.joining_date) = date_trunc('month', current_date) - (n || ' months')::interval
        and md.status = 'active'
    ), 0) / nullif((
      select count(*) from public.member_details md
      where md.gym_id = p_gym_id
        and date_trunc('month', md.joining_date) = date_trunc('month', current_date) - (n || ' months')::interval
    ), 0), 1) as retention_rate
  from generate_series(1, 6) n
  order by cohort_months_ago;
$$;

-- ============================================================================
-- Grant execute on all report/analytics functions to authenticated role —
-- they're security definer and internally scoped by p_gym_id, but the RLS-
-- equivalent gating happens in the calling Server Action via has_permission().
-- ============================================================================
grant execute on function
  public.report_revenue(uuid, date, date),
  public.report_membership_summary(uuid),
  public.report_attendance(uuid, date, date),
  public.report_trainer_performance(uuid, date, date),
  public.report_inventory(uuid, date, date),
  public.report_payments_by_method(uuid, date, date),
  public.report_profit_loss(uuid, date, date),
  public.analytics_growth(uuid, date, date),
  public.analytics_renewal_rate(uuid, date, date),
  public.analytics_retention(uuid)
to authenticated;
