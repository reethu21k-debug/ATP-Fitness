-- ============================================================================
-- GymOS — Part 15: Member Check-in Streaks
-- One row per member. Updated automatically by a trigger on attendance_records
-- insert, so it works for QR check-ins, manual front-desk check-ins, and any
-- future check-in method — no application code has to remember to call it.
--
-- Rules:
--   - A streak "day" = at least one check-in on a calendar date. Multiple
--     check-ins on the same day do not extend the streak further.
--   - Consecutive days -> streak += 1.
--   - Exactly 1 day missed since the last check-in -> streak continues,
--     but only if the member has not already used their grace day in the
--     current 7-day grace window (grace_period_start).
--   - 2+ days missed, or a 2nd miss within the same grace window -> streak
--     resets to 1 (today's check-in starts a new streak).
-- ============================================================================

create table public.member_streaks (
  member_id uuid primary key references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_checkin_date date,
  grace_period_start date,   -- start (Mon) of the 7-day window the grace day belongs to
  grace_used boolean not null default false,
  updated_at timestamptz not null default now()
);

create index idx_member_streaks_gym on public.member_streaks(gym_id, current_streak desc);

alter table public.member_streaks enable row level security;

create policy "member_streaks_select" on public.member_streaks for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );

-- No insert/update/delete policies for regular clients — the trigger below
-- runs as the table owner (security definer function) and is the only writer.

-- ============================================================================
-- FUNCTION: recompute streak for a member off the back of a new check-in
-- ============================================================================
create or replace function public.update_member_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  checkin_date date := (new.check_in_at at time zone 'utc')::date;
  existing public.member_streaks%rowtype;
  days_gap int;
  week_start date := checkin_date - ((extract(dow from checkin_date)::int + 6) % 7); -- Monday of this week
begin
  select * into existing from public.member_streaks where member_id = new.member_id for update;

  if not found then
    insert into public.member_streaks (member_id, gym_id, current_streak, longest_streak, last_checkin_date, grace_period_start, grace_used)
    values (new.member_id, new.gym_id, 1, 1, checkin_date, week_start, false);
    return new;
  end if;

  -- Same day as last recorded check-in: no change, just ensure gym_id is current.
  if existing.last_checkin_date = checkin_date then
    return new;
  end if;

  days_gap := checkin_date - existing.last_checkin_date;

  -- Reset the weekly grace window if we've moved into a new week.
  if existing.grace_period_start is null or existing.grace_period_start <> week_start then
    existing.grace_used := false;
    existing.grace_period_start := week_start;
  end if;

  if days_gap = 1 then
    -- Consecutive day: streak continues normally.
    existing.current_streak := existing.current_streak + 1;
  elsif days_gap = 2 and not existing.grace_used then
    -- Exactly one day missed, and grace not yet used this week: streak survives.
    existing.current_streak := existing.current_streak + 1;
    existing.grace_used := true;
  else
    -- Too many days missed, or grace already used: streak restarts today.
    existing.current_streak := 1;
  end if;

  existing.longest_streak := greatest(existing.longest_streak, existing.current_streak);
  existing.last_checkin_date := checkin_date;
  existing.gym_id := new.gym_id;
  existing.updated_at := now();

  update public.member_streaks
  set current_streak = existing.current_streak,
      longest_streak = existing.longest_streak,
      last_checkin_date = existing.last_checkin_date,
      grace_period_start = existing.grace_period_start,
      grace_used = existing.grace_used,
      gym_id = existing.gym_id,
      updated_at = existing.updated_at
  where member_id = existing.member_id;

  return new;
end;
$$;

create trigger trg_update_member_streak
  after insert on public.attendance_records
  for each row execute function public.update_member_streak();

-- ============================================================================
-- Gym-wide view for staff/owner engagement tracking (top streaks + at-risk).
-- "At risk" = streak is still alive but they haven't checked in today or
-- yesterday, so it will break tomorrow without a grace day already spent.
-- ============================================================================
create or replace view public.member_streaks_overview as
select
  s.member_id,
  s.gym_id,
  p.full_name as member_name,
  p.avatar_url,
  s.current_streak,
  s.longest_streak,
  s.last_checkin_date,
  s.grace_used,
  (current_date - s.last_checkin_date) as days_since_checkin
from public.member_streaks s
join public.profiles p on p.id = s.member_id
where s.current_streak > 0;

alter view public.member_streaks_overview set (security_invoker = true);