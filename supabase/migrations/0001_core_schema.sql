-- ============================================================================
-- GymOS Core Schema — Part 1
-- Multi-tenancy, Roles, Profiles, RLS foundation
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.app_role as enum (
  'super_admin',
  'gym_owner',
  'receptionist',
  'trainer',
  'member'
);

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'suspended'
);

create type public.member_status as enum (
  'active', 'inactive', 'expired', 'frozen', 'cancelled'
);

-- ============================================================================
-- PLATFORM: TENANTS (Gym Businesses) & BRANCHES
-- A "tenant" is the top-level owner account (one owner -> many gyms/branches)
-- ============================================================================

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid, -- fk added after profiles table exists
  logo_url text,
  primary_color text default '#6366F1',
  subscription_plan text not null default 'trial',
  subscription_status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  feature_flags jsonb not null default '{}'::jsonb,
  billing_email text,
  is_white_label boolean not null default false,
  custom_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  city text,
  state text,
  country text default 'India',
  postal_code text,
  phone text,
  email text,
  timezone text default 'Asia/Kolkata',
  latitude double precision,
  longitude double precision,
  gps_checkin_radius_meters int default 200,
  opening_hours jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index idx_gyms_tenant on public.gyms(tenant_id);

-- ============================================================================
-- PROFILES (extends auth.users) + ROLE ASSIGNMENT
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  role public.app_role not null default 'member',
  full_name text not null,
  email text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  two_factor_enabled boolean not null default false,
  two_factor_secret text,
  must_reset_password boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_tenant on public.profiles(tenant_id);
create index idx_profiles_gym on public.profiles(gym_id);
create index idx_profiles_role on public.profiles(role);

alter table public.tenants
  add constraint tenants_owner_fk foreign key (owner_id) references public.profiles(id) on delete set null;

-- Per-gym permission overrides (fine-grained RBAC beyond the 5 base roles)
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  resource text not null,      -- e.g. 'members', 'revenue_reports', 'settings'
  action text not null,        -- e.g. 'create', 'read', 'update', 'delete'
  allowed boolean not null default true,
  unique (role, resource, action)
);

create table public.staff_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  resource text not null,
  action text not null,
  allowed boolean not null,
  created_at timestamptz not null default now(),
  unique (profile_id, resource, action)
);

-- ============================================================================
-- AUDIT LOG (every sensitive action)
-- ============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index idx_audit_tenant on public.audit_logs(tenant_id, created_at desc);

-- ============================================================================
-- SUPPORT TICKETS (Super Admin <-> Gym Owners)
-- ============================================================================

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  subject text not null,
  description text not null,
  status text not null default 'open', -- open, in_progress, resolved, closed
  priority text not null default 'normal',
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- updated_at trigger helper (reused across all tables)
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger trg_gyms_updated_at before update on public.gyms
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ============================================================================
-- AUTH HELPER FUNCTIONS (used throughout every RLS policy in the project)
-- SECURITY DEFINER so they can read profiles without recursive RLS issues
-- ============================================================================

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_gym_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.is_gym_owner_or_above()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin','gym_owner')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin','gym_owner','receptionist','trainer')
  );
$$;

create or replace function public.has_permission(p_resource text, p_action text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.app_role;
  v_override boolean;
  v_default boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then return false; end if;
  if v_role = 'super_admin' then return true; end if;

  select allowed into v_override
  from public.staff_permission_overrides
  where profile_id = auth.uid() and resource = p_resource and action = p_action;

  if v_override is not null then return v_override; end if;

  select allowed into v_default
  from public.permissions
  where role = v_role and resource = p_resource and action = p_action;

  return coalesce(v_default, false);
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.tenants enable row level security;
alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.staff_permission_overrides enable row level security;
alter table public.audit_logs enable row level security;
alter table public.support_tickets enable row level security;

-- TENANTS: super admin sees all; owner sees their own tenant; staff/members see their own tenant read-only
create policy "tenants_select" on public.tenants for select
  using (public.is_super_admin() or id = public.current_tenant_id());

create policy "tenants_insert_super_admin" on public.tenants for insert
  with check (public.is_super_admin());

create policy "tenants_update" on public.tenants for update
  using (public.is_super_admin() or (owner_id = auth.uid()))
  with check (public.is_super_admin() or (owner_id = auth.uid()));

create policy "tenants_delete_super_admin" on public.tenants for delete
  using (public.is_super_admin());

-- GYMS: scoped to tenant
create policy "gyms_select" on public.gyms for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

create policy "gyms_insert" on public.gyms for insert
  with check (public.is_super_admin() or (tenant_id = public.current_tenant_id() and public.current_role() = 'gym_owner'));

create policy "gyms_update" on public.gyms for update
  using (public.is_super_admin() or (tenant_id = public.current_tenant_id() and public.current_role() = 'gym_owner'));

create policy "gyms_delete" on public.gyms for delete
  using (public.is_super_admin() or (tenant_id = public.current_tenant_id() and public.current_role() = 'gym_owner'));

-- PROFILES: users see themselves; staff see everyone in their tenant; super admin sees all
create policy "profiles_select" on public.profiles for select
  using (
    public.is_super_admin()
    or id = auth.uid()
    or tenant_id = public.current_tenant_id()
  );

create policy "profiles_insert" on public.profiles for insert
  with check (
    public.is_super_admin()
    or id = auth.uid()
    or (tenant_id = public.current_tenant_id() and public.is_staff())
  );

create policy "profiles_update" on public.profiles for update
  using (
    public.is_super_admin()
    or id = auth.uid()
    or (tenant_id = public.current_tenant_id() and public.current_role() in ('gym_owner','receptionist'))
  );

create policy "profiles_delete" on public.profiles for delete
  using (public.is_super_admin() or public.current_role() = 'gym_owner');

-- PERMISSIONS (global default matrix): readable by all authenticated, writable by super admin only
create policy "permissions_select" on public.permissions for select using (true);
create policy "permissions_write_super_admin" on public.permissions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- STAFF OVERRIDES: gym owner manages their own staff; super admin manages all
create policy "overrides_select" on public.staff_permission_overrides for select
  using (
    public.is_super_admin()
    or profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = profile_id and p.tenant_id = public.current_tenant_id())
  );
create policy "overrides_write" on public.staff_permission_overrides for all
  using (public.is_super_admin() or public.current_role() = 'gym_owner')
  with check (public.is_super_admin() or public.current_role() = 'gym_owner');

-- AUDIT LOGS: read-only to tenant admins, insert by any authenticated staff action (via server actions/service role)
create policy "audit_select" on public.audit_logs for select
  using (public.is_super_admin() or (tenant_id = public.current_tenant_id() and public.current_role() = 'gym_owner'));
create policy "audit_insert" on public.audit_logs for insert
  with check (auth.uid() is not null);

-- SUPPORT TICKETS
create policy "tickets_select" on public.support_tickets for select
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());
create policy "tickets_insert" on public.support_tickets for insert
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());
create policy "tickets_update" on public.support_tickets for update
  using (public.is_super_admin() or tenant_id = public.current_tenant_id());

-- ============================================================================
-- SEED DEFAULT PERMISSION MATRIX
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','members','create',true), ('gym_owner','members','read',true),
  ('gym_owner','members','update',true), ('gym_owner','members','delete',true),
  ('gym_owner','revenue_reports','read',true), ('gym_owner','settings','update',true),
  ('receptionist','members','create',true), ('receptionist','members','read',true),
  ('receptionist','members','update',true), ('receptionist','members','delete',false),
  ('receptionist','revenue_reports','read',false), ('receptionist','settings','update',false),
  ('receptionist','payments','create',true), ('receptionist','attendance','create',true),
  ('trainer','workout_plans','create',true), ('trainer','workout_plans','read',true),
  ('trainer','diet_plans','create',true), ('trainer','members','read',true),
  ('trainer','members','update',false), ('trainer','members','delete',false),
  ('member','profile','read',true), ('member','profile','update',true)
on conflict (role, resource, action) do nothing;

-- ============================================================================
-- HANDLE NEW AUTH USER -> auto-create profile row
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.phone,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
