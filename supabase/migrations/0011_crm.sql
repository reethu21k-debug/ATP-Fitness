-- ============================================================================
-- GymOS — Part 7: Receptionist & CRM
-- Leads pipeline (walk-ins, trials, conversions, follow-ups)
-- ============================================================================

create type public.lead_status as enum ('new', 'contacted', 'trial_scheduled', 'trial_completed', 'converted', 'lost');
create type public.lead_source as enum ('walk_in', 'referral', 'online', 'phone', 'social', 'other');
create type public.lead_activity_type as enum ('call', 'whatsapp', 'email', 'note', 'status_change', 'trial_scheduled');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  source public.lead_source not null default 'walk_in',
  status public.lead_status not null default 'new',
  interested_plan_id uuid references public.membership_plans(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  trial_date timestamptz,
  follow_up_date date,
  notes text,
  converted_member_id uuid references public.profiles(id) on delete set null,
  lost_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_gym on public.leads(gym_id, status);
create index idx_leads_follow_up on public.leads(gym_id, follow_up_date) where status not in ('converted', 'lost');
create index idx_leads_assigned on public.leads(assigned_to);

create trigger trg_leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  activity_type public.lead_activity_type not null,
  description text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_lead_activities_lead on public.lead_activities(lead_id, created_at desc);

-- Auto-log every status change as an activity, so the timeline is always complete.
create or replace function public.log_lead_status_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_activities (lead_id, gym_id, activity_type, description, created_by)
    values (new.id, new.gym_id, 'status_change', 'Status changed from ' || old.status || ' to ' || new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_lead_status_change
  after update of status on public.leads
  for each row execute function public.log_lead_status_change();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;

create policy "leads_select" on public.leads for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "leads_insert" on public.leads for insert
  with check (public.is_super_admin() or (public.has_permission('leads','create') and gym_id = public.current_gym_id()));
create policy "leads_update" on public.leads for update
  using (public.is_super_admin() or (public.has_permission('leads','update') and gym_id = public.current_gym_id()));
create policy "leads_delete" on public.leads for delete
  using (public.is_super_admin() or (public.has_permission('leads','delete') and gym_id = public.current_gym_id()));

create policy "lead_activities_select" on public.lead_activities for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "lead_activities_insert" on public.lead_activities for insert
  with check (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));

-- ============================================================================
-- PERMISSION MATRIX
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','leads','create',true), ('gym_owner','leads','read',true),
  ('gym_owner','leads','update',true), ('gym_owner','leads','delete',true),
  ('receptionist','leads','create',true), ('receptionist','leads','read',true),
  ('receptionist','leads','update',true), ('receptionist','leads','delete',false)
on conflict (role, resource, action) do nothing;

-- ============================================================================
-- VIEW: leads with assignee/plan context (for the pipeline board)
-- ============================================================================

create or replace view public.leads_overview as
select
  l.id, l.gym_id, l.name, l.phone, l.email, l.source, l.status,
  l.interested_plan_id, mp.name as plan_name,
  l.assigned_to, pr.full_name as assigned_to_name,
  l.trial_date, l.follow_up_date, l.notes, l.converted_member_id, l.lost_reason,
  l.created_at, l.updated_at
from public.leads l
left join public.membership_plans mp on mp.id = l.interested_plan_id
left join public.profiles pr on pr.id = l.assigned_to;

alter view public.leads_overview set (security_invoker = true);
