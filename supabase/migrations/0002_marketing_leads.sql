-- ============================================================================
-- Marketing site contact form submissions.
-- These are anonymous, pre-tenant leads — distinct from support_tickets,
-- which are always scoped to an existing tenant.
-- ============================================================================

create table public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  gym_name text,
  message text not null,
  status text not null default 'new', -- new, contacted, converted, dismissed
  created_at timestamptz not null default now()
);

create index idx_marketing_leads_status on public.marketing_leads(status, created_at desc);

alter table public.marketing_leads enable row level security;

-- Anyone (anonymous visitors) can submit; only super admins can read/manage.
-- Inserts happen exclusively via the service-role client in the contact
-- Server Action, so no public insert policy is needed here.
create policy "marketing_leads_select_super_admin" on public.marketing_leads for select
  using (public.is_super_admin());

create policy "marketing_leads_update_super_admin" on public.marketing_leads for update
  using (public.is_super_admin());
