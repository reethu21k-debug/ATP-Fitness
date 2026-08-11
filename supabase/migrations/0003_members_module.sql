-- ============================================================================
-- GymOS — Part 3: Members Module
-- membership_plans, member_details (extends profiles for role=member),
-- member_memberships, member_documents
-- ============================================================================

create type public.payment_status as enum ('paid', 'partial', 'pending', 'refunded');
create type public.gender as enum ('male', 'female', 'other', 'prefer_not_to_say');
create type public.blood_group as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown');

-- ============================================================================
-- MEMBERSHIP PLANS (per-gym catalog: 1/3/6/12 month + custom)
-- ============================================================================

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  duration_days int not null,               -- 30, 90, 180, 365, or custom
  price numeric(10,2) not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_plans_gym on public.membership_plans(gym_id);

create trigger trg_plans_updated_at before update on public.membership_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- MEMBER DETAILS (1:1 extension of profiles where role = 'member')
-- ============================================================================

create table public.member_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  date_of_birth date,
  gender public.gender,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  blood_group public.blood_group default 'unknown',
  medical_conditions text,
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  joining_date date not null default current_date,
  assigned_trainer_id uuid references public.profiles(id) on delete set null,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_member_details_gym on public.member_details(gym_id);
create index idx_member_details_trainer on public.member_details(assigned_trainer_id);
create index idx_member_details_status on public.member_details(status);

create trigger trg_member_details_updated_at before update on public.member_details
  for each row execute function public.set_updated_at();

-- ============================================================================
-- MEMBER MEMBERSHIPS (renewal history: one row per membership period)
-- ============================================================================

create table public.member_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  plan_id uuid references public.membership_plans(id) on delete set null,
  start_date date not null default current_date,
  end_date date not null,
  amount numeric(10,2) not null,
  discount_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  payment_status public.payment_status not null default 'pending',
  trainer_id uuid references public.profiles(id) on delete set null,
  is_current boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_memberships_member on public.member_memberships(member_id);
create index idx_memberships_gym on public.member_memberships(gym_id);
create index idx_memberships_end_date on public.member_memberships(end_date);
create index idx_memberships_current on public.member_memberships(member_id, is_current) where is_current;

create trigger trg_memberships_updated_at before update on public.member_memberships
  for each row execute function public.set_updated_at();

-- Only one "current" membership per member at a time.
create or replace function public.enforce_single_current_membership()
returns trigger
language plpgsql
as $$
begin
  if new.is_current then
    update public.member_memberships
    set is_current = false
    where member_id = new.member_id and id <> new.id and is_current = true;

    update public.member_details
    set status = 'active'
    where profile_id = new.member_id;
  end if;
  return new;
end;
$$;

create trigger trg_single_current_membership
  after insert or update of is_current on public.member_memberships
  for each row when (new.is_current) execute function public.enforce_single_current_membership();

-- ============================================================================
-- MEMBER DOCUMENTS (certificates, transformation photos, medical docs — Cloudinary)
-- ============================================================================

create table public.member_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  doc_type text not null, -- 'photo', 'transformation', 'certificate', 'medical', 'other'
  cloudinary_public_id text not null,
  url text not null,
  caption text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_documents_member on public.member_documents(member_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.membership_plans enable row level security;
alter table public.member_details enable row level security;
alter table public.member_memberships enable row level security;
alter table public.member_documents enable row level security;

-- PLANS: readable by everyone in the tenant, writable by owner
create policy "plans_select" on public.membership_plans for select
  using (
    public.is_super_admin()
    or exists (select 1 from public.gyms g where g.id = gym_id and g.tenant_id = public.current_tenant_id())
  );
create policy "plans_write" on public.membership_plans for all
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));

-- MEMBER DETAILS: staff in the same gym can read/write per has_permission();
-- the member themself can read (and update limited fields via a narrower
-- Server Action, RLS here just gates row visibility).
create policy "member_details_select" on public.member_details for select
  using (
    public.is_super_admin()
    or profile_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );
create policy "member_details_insert" on public.member_details for insert
  with check (public.is_super_admin() or (public.has_permission('members','create') and gym_id = public.current_gym_id()));
create policy "member_details_update" on public.member_details for update
  using (
    public.is_super_admin()
    or (public.has_permission('members','update') and gym_id = public.current_gym_id())
    or profile_id = auth.uid()
  );
create policy "member_details_delete" on public.member_details for delete
  using (public.is_super_admin() or (public.has_permission('members','delete') and gym_id = public.current_gym_id()));

-- MEMBERSHIPS: staff in gym manage; member reads own
create policy "memberships_select" on public.member_memberships for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );
create policy "memberships_write" on public.member_memberships for all
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));

-- DOCUMENTS: staff in gym manage; member reads/uploads own
create policy "documents_select" on public.member_documents for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );
create policy "documents_insert" on public.member_documents for insert
  with check (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );
create policy "documents_delete" on public.member_documents for delete
  using (public.is_super_admin() or (public.has_permission('members','update') and gym_id = public.current_gym_id()));

-- ============================================================================
-- VIEW: members list with computed current-membership fields (for the table UI)
-- ============================================================================

create or replace view public.members_overview as
select
  p.id as profile_id,
  p.tenant_id,
  p.gym_id,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url,
  p.is_active,
  md.date_of_birth,
  md.gender,
  md.status,
  md.joining_date,
  md.assigned_trainer_id,
  tr.full_name as trainer_name,
  mm.id as membership_id,
  mm.plan_id,
  mp.name as plan_name,
  mm.start_date,
  mm.end_date,
  mm.payment_status,
  mm.amount,
  mm.amount_paid,
  (mm.end_date - current_date) as days_until_expiry
from public.profiles p
join public.member_details md on md.profile_id = p.id
left join public.profiles tr on tr.id = md.assigned_trainer_id
left join public.member_memberships mm on mm.member_id = p.id and mm.is_current = true
left join public.membership_plans mp on mp.id = mm.plan_id
where p.role = 'member';

alter view public.members_overview set (security_invoker = true);
