-- ============================================================================
-- GymOS — Part 6: Trainer Module
-- Workout planner, diet planner, progress tracking (transformation photos
-- already live in member_documents from Part 3)
-- ============================================================================

create type public.plan_frequency as enum ('daily', 'weekly', 'monthly');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snacks');

-- ============================================================================
-- WORKOUT PLANS
-- ============================================================================

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  frequency public.plan_frequency not null default 'weekly',
  start_date date not null default current_date,
  end_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workout_plans_member on public.workout_plans(member_id);
create index idx_workout_plans_trainer on public.workout_plans(trainer_id);

create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  workout_plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_label text not null,   -- 'Monday', 'Day 1', 'Week 1', etc. depending on frequency
  day_order int not null default 0,
  notes text
);

create index idx_workout_days_plan on public.workout_days(workout_plan_id);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_days(id) on delete cascade,
  exercise_name text not null,
  sets int,
  reps text,              -- text to allow ranges like "8-12" or "AMRAP"
  weight_kg numeric(6,2),
  video_url text,
  notes text,
  order_index int not null default 0
);

create index idx_workout_exercises_day on public.workout_exercises(workout_day_id);

create trigger trg_workout_plans_updated_at before update on public.workout_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- DIET PLANS
-- ============================================================================

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  start_date date not null default current_date,
  end_date date,
  daily_calorie_target int,
  daily_protein_g numeric(6,2),
  daily_carbs_g numeric(6,2),
  daily_fat_g numeric(6,2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_diet_plans_member on public.diet_plans(member_id);
create index idx_diet_plans_trainer on public.diet_plans(trainer_id);

create table public.diet_meals (
  id uuid primary key default gen_random_uuid(),
  diet_plan_id uuid not null references public.diet_plans(id) on delete cascade,
  meal_type public.meal_type not null,
  items text not null,      -- freeform description, e.g. "2 eggs, 1 toast, 1 banana"
  calories int,
  protein_g numeric(6,2),
  carbs_g numeric(6,2),
  fat_g numeric(6,2),
  order_index int not null default 0
);

create index idx_diet_meals_plan on public.diet_meals(diet_plan_id);

create trigger trg_diet_plans_updated_at before update on public.diet_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- PROGRESS TRACKING (measurements, BMI, body fat — charted weekly/monthly/yearly)
-- ============================================================================

create table public.member_progress (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at date not null default current_date,
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,1),
  chest_cm numeric(5,2),
  waist_cm numeric(5,2),
  hips_cm numeric(5,2),
  arms_cm numeric(5,2),
  thighs_cm numeric(5,2),
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_progress_member on public.member_progress(member_id, recorded_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.diet_plans enable row level security;
alter table public.diet_meals enable row level security;
alter table public.member_progress enable row level security;

-- Trainers manage plans for members assigned to them; gym owner sees/manages
-- all in their gym; member reads their own.
create policy "workout_plans_select" on public.workout_plans for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or trainer_id = auth.uid()
    or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id())
  );
create policy "workout_plans_write" on public.workout_plans for all
  using (
    public.is_super_admin()
    or trainer_id = auth.uid()
    or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id())
  )
  with check (
    public.is_super_admin()
    or trainer_id = auth.uid()
    or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id())
  );

create policy "workout_days_select" on public.workout_days for select
  using (exists (
    select 1 from public.workout_plans wp where wp.id = workout_plan_id
    and (public.is_super_admin() or wp.member_id = auth.uid() or wp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and wp.gym_id = public.current_gym_id()))
  ));
create policy "workout_days_write" on public.workout_days for all
  using (exists (
    select 1 from public.workout_plans wp where wp.id = workout_plan_id
    and (public.is_super_admin() or wp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and wp.gym_id = public.current_gym_id()))
  ))
  with check (exists (
    select 1 from public.workout_plans wp where wp.id = workout_plan_id
    and (public.is_super_admin() or wp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and wp.gym_id = public.current_gym_id()))
  ));

create policy "workout_exercises_select" on public.workout_exercises for select
  using (exists (
    select 1 from public.workout_days wd join public.workout_plans wp on wp.id = wd.workout_plan_id
    where wd.id = workout_day_id
    and (public.is_super_admin() or wp.member_id = auth.uid() or wp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and wp.gym_id = public.current_gym_id()))
  ));
create policy "workout_exercises_write" on public.workout_exercises for all
  using (exists (
    select 1 from public.workout_days wd join public.workout_plans wp on wp.id = wd.workout_plan_id
    where wd.id = workout_day_id
    and (public.is_super_admin() or wp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and wp.gym_id = public.current_gym_id()))
  ))
  with check (exists (
    select 1 from public.workout_days wd join public.workout_plans wp on wp.id = wd.workout_plan_id
    where wd.id = workout_day_id
    and (public.is_super_admin() or wp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and wp.gym_id = public.current_gym_id()))
  ));

create policy "diet_plans_select" on public.diet_plans for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or trainer_id = auth.uid()
    or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id())
  );
create policy "diet_plans_write" on public.diet_plans for all
  using (
    public.is_super_admin()
    or trainer_id = auth.uid()
    or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id())
  )
  with check (
    public.is_super_admin()
    or trainer_id = auth.uid()
    or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id())
  );

create policy "diet_meals_select" on public.diet_meals for select
  using (exists (
    select 1 from public.diet_plans dp where dp.id = diet_plan_id
    and (public.is_super_admin() or dp.member_id = auth.uid() or dp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and dp.gym_id = public.current_gym_id()))
  ));
create policy "diet_meals_write" on public.diet_meals for all
  using (exists (
    select 1 from public.diet_plans dp where dp.id = diet_plan_id
    and (public.is_super_admin() or dp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and dp.gym_id = public.current_gym_id()))
  ))
  with check (exists (
    select 1 from public.diet_plans dp where dp.id = diet_plan_id
    and (public.is_super_admin() or dp.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and dp.gym_id = public.current_gym_id()))
  ));

create policy "progress_select" on public.member_progress for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );
create policy "progress_write" on public.member_progress for all
  using (
    public.is_super_admin()
    or (public.is_staff() and gym_id = public.current_gym_id())
    or member_id = auth.uid()
  )
  with check (
    public.is_super_admin()
    or (public.is_staff() and gym_id = public.current_gym_id())
    or member_id = auth.uid()
  );

-- ============================================================================
-- PERMISSION MATRIX ADDITIONS
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('trainer','workout_plans','update',true), ('trainer','workout_plans','delete',true),
  ('trainer','diet_plans','read',true), ('trainer','diet_plans','update',true), ('trainer','diet_plans','delete',true),
  ('trainer','progress','create',true), ('trainer','progress','read',true),
  ('gym_owner','workout_plans','create',true), ('gym_owner','workout_plans','read',true),
  ('gym_owner','diet_plans','create',true), ('gym_owner','diet_plans','read',true),
  ('gym_owner','progress','create',true), ('gym_owner','progress','read',true),
  ('member','workout_plans','read',true), ('member','diet_plans','read',true), ('member','progress','read',true)
on conflict (role, resource, action) do nothing;
