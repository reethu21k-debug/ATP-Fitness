-- ============================================================================
-- GymOS — Part 5: Attendance
-- Stateless rotating QR (HMAC-signed, no token table needed) + check-in records
-- ============================================================================

create type public.checkin_method as enum ('qr', 'manual');

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  duration_minutes int,
  method public.checkin_method not null default 'qr',
  gps_lat double precision,
  gps_lng double precision,
  gps_verified boolean not null default false,
  checked_in_by uuid references public.profiles(id), -- staff, for manual check-ins
  created_at timestamptz not null default now()
);

create index idx_attendance_gym_date on public.attendance_records(gym_id, check_in_at desc);
create index idx_attendance_member on public.attendance_records(member_id, check_in_at desc);
-- Enforce: a member can't have two open (not checked-out) sessions at once.
create unique index idx_attendance_one_open_session
  on public.attendance_records(member_id)
  where check_out_at is null;

-- Auto-compute duration on checkout.
create or replace function public.compute_attendance_duration()
returns trigger
language plpgsql
as $$
begin
  if new.check_out_at is not null and old.check_out_at is null then
    new.duration_minutes := greatest(0, round(extract(epoch from (new.check_out_at - new.check_in_at)) / 60)::int);
  end if;
  return new;
end;
$$;

create trigger trg_attendance_duration
  before update of check_out_at on public.attendance_records
  for each row execute function public.compute_attendance_duration();

alter table public.attendance_records enable row level security;

create policy "attendance_select" on public.attendance_records for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );

create policy "attendance_insert" on public.attendance_records for insert
  with check (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );

create policy "attendance_update" on public.attendance_records for update
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );

-- ============================================================================
-- VIEW: today's attendance with member context (for the front-desk dashboard)
-- ============================================================================

create or replace view public.attendance_today as
select
  a.id,
  a.gym_id,
  a.member_id,
  p.full_name as member_name,
  p.avatar_url,
  a.check_in_at,
  a.check_out_at,
  a.duration_minutes,
  a.method,
  a.gps_verified
from public.attendance_records a
join public.profiles p on p.id = a.member_id
where a.check_in_at >= date_trunc('day', now())
order by a.check_in_at desc;

alter view public.attendance_today set (security_invoker = true);
