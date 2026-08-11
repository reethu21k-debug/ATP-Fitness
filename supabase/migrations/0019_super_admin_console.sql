-- ============================================================================
-- GymOS — Part 12: Super Admin Console
-- Subscription plan catalog, platform billing/invoices, feature flag catalog,
-- platform settings (singleton), support ticket threaded replies, and
-- platform-wide analytics functions. Every table here is super-admin-only —
-- this module manages the platform itself, not any single tenant's data.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.invoice_status as enum (
  'draft', 'open', 'paid', 'void', 'uncollectible'
);

-- ============================================================================
-- SUBSCRIPTION PLAN CATALOG
-- The platform's own pricing plans (distinct from a gym's membership_plans,
-- which are what a gym sells to ITS members). Tenants.subscription_plan
-- stores the `code` of one of these rows.
-- ============================================================================

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'trial', 'starter', 'growth', 'enterprise'
  name text not null,
  description text,
  monthly_price numeric(10,2) not null default 0,
  annual_price numeric(10,2) not null default 0,
  currency text not null default 'INR',
  max_gyms int, -- null = unlimited
  max_members int, -- null = unlimited
  max_staff int, -- null = unlimited
  features jsonb not null default '[]'::jsonb, -- list of feature strings shown on pricing card
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_subscription_plans_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- PLATFORM BILLING: invoices issued by the platform to a tenant (SaaS fees —
-- not to be confused with a gym's own `payments` table, which is a gym
-- billing its members). Manually recorded/marked-paid for now: no live
-- payment gateway integration is in scope for this module.
-- ============================================================================

create table public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_number text not null unique,
  plan_code text references public.subscription_plans(code),
  billing_period_start date not null,
  billing_period_end date not null,
  amount numeric(10,2) not null,
  currency text not null default 'INR',
  status public.invoice_status not null default 'open',
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_platform_invoices_tenant on public.platform_invoices(tenant_id, issued_at desc);
create index idx_platform_invoices_status on public.platform_invoices(status);

create trigger trg_platform_invoices_updated_at before update on public.platform_invoices
  for each row execute function public.set_updated_at();

-- Gapless platform invoice numbers, same pattern as the gym-level
-- next_invoice_number/next_receipt_number functions from Part 4.
create sequence if not exists public.platform_invoice_seq;

create or replace function public.next_platform_invoice_number()
returns text
language sql
security definer set search_path = public
as $$
  select 'PLT-INV-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.platform_invoice_seq')::text, 6, '0');
$$;

-- ============================================================================
-- FEATURE FLAG CATALOG
-- A known-flags registry so Super Admin gets a real toggle UI (name,
-- description, default) instead of hand-typing arbitrary JSON keys.
-- The actual per-tenant on/off state still lives in tenants.feature_flags
-- jsonb (added in Part 1) — this table is the catalog of *what* a flag
-- means and its platform-wide default, not a duplicate of tenant state.
-- ============================================================================

create table public.feature_flag_catalog (
  key text primary key, -- e.g. 'ai_features', 'multi_branch', 'white_label'
  label text not null,
  description text,
  default_enabled boolean not null default false,
  category text not null default 'general', -- general, ai, billing, branding
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PLATFORM SETTINGS (singleton row — global config for the whole SaaS)
-- ============================================================================

create table public.platform_settings (
  id boolean primary key default true constraint platform_settings_singleton check (id),
  platform_name text not null default 'GymOS',
  support_email text,
  default_trial_days int not null default 14,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  allow_new_registrations boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

create trigger trg_platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SUPPORT TICKET REPLIES (threaded conversation between platform + tenant)
-- ============================================================================

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  message text not null,
  is_internal_note boolean not null default false, -- super-admin-only private note
  created_at timestamptz not null default now()
);

create index idx_ticket_messages_ticket on public.support_ticket_messages(ticket_id, created_at);

-- ============================================================================
-- TENANT SUSPENSION / IMPERSONATION AUDIT
-- A dedicated log (distinct from the generic audit_logs table) for the two
-- most sensitive super-admin powers, so they're always separately queryable.
-- ============================================================================

create table public.tenant_admin_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null, -- 'suspended', 'reactivated', 'plan_changed', 'flag_toggled', 'impersonation_started'
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_tenant_admin_actions_tenant on public.tenant_admin_actions(tenant_id, created_at desc);

-- ============================================================================
-- RLS — every table here is super-admin-only. Tenants get read-only access
-- to their own invoices (so a gym owner can see what they're billed) and to
-- the ticket messages on their own tickets; nothing else.
-- ============================================================================

alter table public.subscription_plans enable row level security;
alter table public.platform_invoices enable row level security;
alter table public.feature_flag_catalog enable row level security;
alter table public.platform_settings enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.tenant_admin_actions enable row level security;

-- Subscription plans: publicly readable (pricing page needs this), only
-- super admin can write.
create policy "subscription_plans_select" on public.subscription_plans for select
  using (true);
create policy "subscription_plans_write" on public.subscription_plans for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Platform invoices: super admin full access; a tenant's own gym_owner can
-- read (but never write) their own tenant's invoices.
create policy "platform_invoices_select" on public.platform_invoices for select
  using (
    public.is_super_admin()
    or (tenant_id = public.current_tenant_id() and public.current_role() = 'gym_owner')
  );
create policy "platform_invoices_write" on public.platform_invoices for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Feature flag catalog: readable by any authenticated user (settings pages
-- may want to know what a flag means), writable by super admin only.
create policy "feature_flag_catalog_select" on public.feature_flag_catalog for select
  using (auth.uid() is not null);
create policy "feature_flag_catalog_write" on public.feature_flag_catalog for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Platform settings: readable by any authenticated user (e.g. maintenance
-- banner), writable by super admin only.
create policy "platform_settings_select" on public.platform_settings for select
  using (auth.uid() is not null);
create policy "platform_settings_write" on public.platform_settings for update
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Ticket messages: super admin sees/writes all; a tenant's staff can
-- see/write messages on their own tenant's tickets, but never internal notes.
create policy "ticket_messages_select" on public.support_ticket_messages for select
  using (
    public.is_super_admin()
    or (
      not is_internal_note
      and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.tenant_id = public.current_tenant_id()
      )
    )
  );
create policy "ticket_messages_insert" on public.support_ticket_messages for insert
  with check (
    public.is_super_admin()
    or (
      not is_internal_note
      and author_id = auth.uid()
      and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.tenant_id = public.current_tenant_id()
      )
    )
  );

-- Tenant admin actions: super-admin-only, fully.
create policy "tenant_admin_actions_select" on public.tenant_admin_actions for select
  using (public.is_super_admin());
create policy "tenant_admin_actions_insert" on public.tenant_admin_actions for insert
  with check (public.is_super_admin());

-- ============================================================================
-- TENANTS OVERVIEW VIEW — for the Tenants table UI (search/sort/paginate)
-- ============================================================================

create or replace view public.tenants_overview as
select
  t.*,
  owner.full_name as owner_full_name,
  owner.email as owner_email,
  owner.phone as owner_phone,
  (select count(*) from public.gyms g where g.tenant_id = t.id) as gym_count,
  (select count(*) from public.profiles p where p.tenant_id = t.id and p.role = 'member') as member_count
from public.tenants t
left join public.profiles owner on owner.id = t.owner_id;

-- ============================================================================
-- PLATFORM-WIDE ANALYTICS FUNCTIONS (super-admin-only reads, enforced in the
-- Server Action layer via requireRole('super_admin') — these functions
-- themselves are plain aggregations with no gym_id scoping since they are,
-- by design, cross-tenant)
-- ============================================================================

-- MRR + tenant counts by plan and status, for the platform overview page.
create or replace function public.platform_overview_stats()
returns table (
  total_tenants bigint,
  active_tenants bigint,
  trialing_tenants bigint,
  suspended_tenants bigint,
  past_due_tenants bigint,
  total_gyms bigint,
  total_members bigint,
  mrr numeric
)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.tenants) as total_tenants,
    (select count(*) from public.tenants where subscription_status = 'active') as active_tenants,
    (select count(*) from public.tenants where subscription_status = 'trialing') as trialing_tenants,
    (select count(*) from public.tenants where subscription_status = 'suspended') as suspended_tenants,
    (select count(*) from public.tenants where subscription_status = 'past_due') as past_due_tenants,
    (select count(*) from public.gyms) as total_gyms,
    (select count(*) from public.member_details) as total_members,
    coalesce((
      select sum(sp.monthly_price)
      from public.tenants t
      join public.subscription_plans sp on sp.code = t.subscription_plan
      where t.subscription_status = 'active'
    ), 0) as mrr;
$$;

-- New tenants signed up per month, for a growth chart.
create or replace function public.platform_tenant_growth(p_start date, p_end date)
returns table (
  month date,
  new_tenants bigint,
  cumulative_tenants bigint
)
language sql stable security definer set search_path = public
as $$
  with months as (
    select generate_series(date_trunc('month', p_start), date_trunc('month', p_end), interval '1 month')::date as month
  ),
  monthly as (
    select date_trunc('month', created_at)::date as month, count(*) as new_tenants
    from public.tenants
    where created_at::date between p_start and p_end
    group by 1
  )
  select
    m.month,
    coalesce(mo.new_tenants, 0) as new_tenants,
    (select count(*) from public.tenants t where t.created_at::date <= (m.month + interval '1 month' - interval '1 day')::date) as cumulative_tenants
  from months m
  left join monthly mo on mo.month = m.month
  order by m.month;
$$;

-- Per-tenant usage summary for the tenant detail page.
create or replace function public.tenant_usage_summary(p_tenant_id uuid)
returns table (
  gym_count bigint,
  staff_count bigint,
  member_count bigint,
  active_member_count bigint,
  total_revenue numeric,
  last_activity_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.gyms where tenant_id = p_tenant_id) as gym_count,
    (select count(*) from public.profiles where tenant_id = p_tenant_id and role in ('gym_owner','receptionist','trainer')) as staff_count,
    (select count(*) from public.profiles where tenant_id = p_tenant_id and role = 'member') as member_count,
    (select count(*) from public.member_details md join public.gyms g on g.id = md.gym_id where g.tenant_id = p_tenant_id and md.status = 'active') as active_member_count,
    coalesce((select sum(p.total_amount) from public.payments p join public.gyms g on g.id = p.gym_id where g.tenant_id = p_tenant_id), 0) as total_revenue,
    (select max(last_login_at) from public.profiles where tenant_id = p_tenant_id) as last_activity_at;
$$;

-- Support ticket volume/status breakdown for the platform overview.
create or replace function public.platform_ticket_stats()
returns table (
  open_count bigint,
  in_progress_count bigint,
  resolved_count bigint,
  closed_count bigint,
  urgent_open_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where status = 'open') as open_count,
    count(*) filter (where status = 'in_progress') as in_progress_count,
    count(*) filter (where status = 'resolved') as resolved_count,
    count(*) filter (where status = 'closed') as closed_count,
    count(*) filter (where status = 'open' and priority = 'urgent') as urgent_open_count
  from public.support_tickets;
$$;

-- ============================================================================
-- TENANT SUSPEND / REACTIVATE (server-authoritative — the same function the
-- Server Action calls, so suspension can never be a client-only UI flag)
-- ============================================================================

create or replace function public.suspend_tenant(p_tenant_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can suspend a tenant.';
  end if;

  update public.tenants set subscription_status = 'suspended' where id = p_tenant_id;

  insert into public.tenant_admin_actions (tenant_id, actor_id, action, reason)
  values (p_tenant_id, auth.uid(), 'suspended', p_reason);
end;
$$;

create or replace function public.reactivate_tenant(p_tenant_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can reactivate a tenant.';
  end if;

  update public.tenants set subscription_status = 'active' where id = p_tenant_id;

  insert into public.tenant_admin_actions (tenant_id, actor_id, action)
  values (p_tenant_id, auth.uid(), 'reactivated');
end;
$$;

-- ============================================================================
-- SEED: default subscription plan catalog (matches tenants.subscription_plan
-- default 'trial' from Part 1, plus the three commercial tiers)
-- ============================================================================

insert into public.subscription_plans (code, name, description, monthly_price, annual_price, max_gyms, max_members, max_staff, features, sort_order) values
  ('trial', 'Trial', '14-day free trial of the Growth plan.', 0, 0, 1, 100, 5,
    '["All Growth features", "14 days, no card required"]'::jsonb, 0),
  ('starter', 'Starter', 'For a single gym just getting started.', 2999, 29990, 1, 200, 5,
    '["1 gym location", "Up to 200 members", "Attendance + payments", "Email support"]'::jsonb, 1),
  ('growth', 'Growth', 'For growing gyms that need marketing and AI tools.', 6999, 69990, 3, 1000, 20,
    '["Up to 3 gym locations", "Up to 1,000 members", "Marketing & CRM", "AI features", "Priority support"]'::jsonb, 2),
  ('enterprise', 'Enterprise', 'For multi-branch chains with custom needs.', 14999, 149990, null, null, null,
    '["Unlimited gym locations", "Unlimited members", "White-label branding", "Dedicated support", "Custom integrations"]'::jsonb, 3)
on conflict (code) do nothing;

-- ============================================================================
-- SEED: feature flag catalog
-- ============================================================================

insert into public.feature_flag_catalog (key, label, description, default_enabled, category) values
  ('ai_features', 'AI Features', 'AI workout/diet generation, chat assistant, risk analysis, revenue forecast.', true, 'ai'),
  ('marketing_campaigns', 'Marketing Campaigns', 'Email/WhatsApp campaigns, coupons, referrals, birthday/festival automation.', true, 'general'),
  ('multi_branch', 'Multi-Branch', 'Allow a tenant to operate more than one gym location.', false, 'general'),
  ('white_label', 'White-Label Branding', 'Custom domain, logo, and primary color instead of GymOS branding.', false, 'branding'),
  ('advanced_reports', 'Advanced Reports & Analytics', 'Profit & loss, growth, renewal-rate, and retention analytics.', true, 'general'),
  ('realtime_chat', 'Realtime Chat', 'Trainer/member/admin realtime chat with attachments.', true, 'general')
on conflict (key) do nothing;

-- ============================================================================
-- PERMISSION MATRIX — platform resources are implicitly super-admin-only via
-- has_permission()'s early `if v_role = 'super_admin' then return true`, so
-- no explicit rows are required for other roles (they simply have none,
-- which resolves to `false` via the coalesce in has_permission). Documented
-- here for clarity rather than adding no-op rows.
-- ============================================================================
