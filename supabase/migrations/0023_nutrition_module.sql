-- ============================================================================
-- GymOS — Part 15: Nutrition / Diet Plan module (v2)
-- Structured food database with automatic macro calculation, meal builder,
-- trainer favorites/quick-add, and per-plan daily targets.
--
-- This is ADDITIVE. It does not touch workout_plans/workout_days/
-- workout_exercises or the legacy diet_plans/diet_meals tables (Part 6,
-- 0010_trainer_module.sql), so existing workout + legacy diet functionality
-- keeps working untouched. The trainer UI now points new plans at this
-- module; old diet_plans rows remain readable for history.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.food_category as enum
  ('protein', 'carbs', 'legumes', 'fruits', 'vegetables', 'dairy', 'supplements', 'other');

create type public.food_state as enum
  ('raw', 'cooked', 'dry', 'prepared', 'drained', 'na');

create type public.nutrition_basis as enum
  ('per_100g', 'per_100ml', 'per_piece', 'per_serving');

create type public.food_unit as enum
  ('g', 'kg', 'ml', 'l', 'piece', 'egg', 'scoop', 'serving');

-- ============================================================================
-- FOOD DATABASE (shared reference data + gym-specific custom foods)
-- ============================================================================

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.food_category not null,
  state public.food_state not null default 'na',
  default_unit public.food_unit not null,
  -- Quantity, in default_unit (grams for g/kg foods, ml for ml/l foods, or a
  -- count of 1 for piece/egg/scoop/serving foods), that food_nutrition below
  -- is measured against. e.g. chicken breast: default_unit='g', basis_quantity=100.
  basis_quantity numeric(8,2) not null default 100,
  is_custom boolean not null default false,
  gym_id uuid references public.gyms(id) on delete cascade,      -- null = global/shared food
  created_by uuid references public.profiles(id) on delete set null,
  source text not null default 'USDA FoodData Central (approx.)',
  created_at timestamptz not null default now()
);

create index idx_foods_category on public.foods(category);
create index idx_foods_name_trgm on public.foods using gin (to_tsvector('simple', name));
create index idx_foods_gym on public.foods(gym_id);

create table public.food_nutrition (
  food_id uuid primary key references public.foods(id) on delete cascade,
  basis public.nutrition_basis not null default 'per_100g',
  calories numeric(7,2) not null default 0,
  protein_g numeric(7,2) not null default 0,
  carbs_g numeric(7,2) not null default 0,
  fat_g numeric(7,2) not null default 0,
  fiber_g numeric(7,2),
  source text not null default 'USDA FoodData Central (approx.)'
);

-- ============================================================================
-- NUTRITION PLANS (v2 — food-database driven, replaces manual entry in the UI)
-- ============================================================================

create table public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null default current_date,
  duration_days int not null default 30,
  calorie_target int,
  protein_target_g numeric(6,2),
  carb_target_g numeric(6,2),
  fat_target_g numeric(6,2),
  fiber_target_g numeric(6,2),
  water_target_ml int,
  meal_frequency int,
  notes text,
  is_active boolean not null default true,
  version int not null default 1,
  parent_plan_id uuid references public.nutrition_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_nutrition_plans_member on public.nutrition_plans(member_id);
create index idx_nutrition_plans_trainer on public.nutrition_plans(trainer_id);

create trigger trg_nutrition_plans_updated_at before update on public.nutrition_plans
  for each row execute function public.set_updated_at();

create table public.nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  nutrition_plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  name text not null,             -- 'Breakfast', 'Pre-Workout', custom names, etc.
  order_index int not null default 0
);

create index idx_nutrition_meals_plan on public.nutrition_meals(nutrition_plan_id);

create table public.nutrition_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.nutrition_meals(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete restrict,
  quantity numeric(8,2) not null default 0,
  unit public.food_unit not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_nutrition_meal_items_meal on public.nutrition_meal_items(meal_id);
create index idx_nutrition_meal_items_food on public.nutrition_meal_items(food_id);

-- ============================================================================
-- TRAINER PERSONALIZATION — favorites + usage (backs both "Frequently Used"
-- and "Recent Foods": ranked by usage_count for frequent, last_used_at for
-- recent). Trainer-specific; never shared across trainers.
-- ============================================================================

create table public.trainer_favorite_foods (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  default_quantity numeric(8,2) not null default 100,
  default_unit public.food_unit not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (trainer_id, food_id)
);

create index idx_trainer_favorites_trainer on public.trainer_favorite_foods(trainer_id, order_index);

create table public.trainer_food_usage (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  usage_count int not null default 1,
  last_quantity numeric(8,2) not null default 100,
  last_unit public.food_unit not null,
  last_used_at timestamptz not null default now(),
  unique (trainer_id, food_id)
);

create index idx_trainer_usage_trainer_recent on public.trainer_food_usage(trainer_id, last_used_at desc);
create index idx_trainer_usage_trainer_frequent on public.trainer_food_usage(trainer_id, usage_count desc);

-- Upsert helper called by the app every time a trainer adds a food to a meal,
-- so "Frequently Used" and "Recent Foods" stay current without extra queries.
create or replace function public.record_trainer_food_usage(
  p_trainer_id uuid, p_food_id uuid, p_quantity numeric, p_unit public.food_unit
) returns void
language sql security definer set search_path = public as $$
  insert into public.trainer_food_usage (trainer_id, food_id, usage_count, last_quantity, last_unit, last_used_at)
  values (p_trainer_id, p_food_id, 1, p_quantity, p_unit, now())
  on conflict (trainer_id, food_id) do update
    set usage_count = public.trainer_food_usage.usage_count + 1,
        last_quantity = excluded.last_quantity,
        last_unit = excluded.last_unit,
        last_used_at = now();
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.foods enable row level security;
alter table public.food_nutrition enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.nutrition_meals enable row level security;
alter table public.nutrition_meal_items enable row level security;
alter table public.trainer_favorite_foods enable row level security;
alter table public.trainer_food_usage enable row level security;

-- Foods are shared reference data: any authenticated user can read them
-- (global rows, or rows scoped to their own gym). Only trainers/gym owners
-- can add custom foods, and only for their own gym.
create policy "foods_select" on public.foods for select
  using (
    auth.uid() is not null
    and (gym_id is null or public.is_super_admin() or gym_id = public.current_gym_id())
  );
create policy "foods_write" on public.foods for insert
  with check (
    public.is_super_admin()
    or (public.is_staff() and gym_id = public.current_gym_id() and created_by = auth.uid())
  );
create policy "foods_update" on public.foods for update
  using (public.is_super_admin() or (created_by = auth.uid() and is_custom))
  with check (public.is_super_admin() or (created_by = auth.uid() and is_custom));
create policy "foods_delete" on public.foods for delete
  using (public.is_super_admin() or (created_by = auth.uid() and is_custom));

create policy "food_nutrition_select" on public.food_nutrition for select
  using (exists (select 1 from public.foods f where f.id = food_id));
create policy "food_nutrition_write" on public.food_nutrition for all
  using (exists (
    select 1 from public.foods f where f.id = food_id
    and (public.is_super_admin() or (f.created_by = auth.uid() and f.is_custom))
  ))
  with check (exists (
    select 1 from public.foods f where f.id = food_id
    and (public.is_super_admin() or (f.created_by = auth.uid() and f.is_custom))
  ));

create policy "nutrition_plans_select" on public.nutrition_plans for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or trainer_id = auth.uid()
    or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id())
  );
create policy "nutrition_plans_write" on public.nutrition_plans for all
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

create policy "nutrition_meals_select" on public.nutrition_meals for select
  using (exists (
    select 1 from public.nutrition_plans np where np.id = nutrition_plan_id
    and (public.is_super_admin() or np.member_id = auth.uid() or np.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and np.gym_id = public.current_gym_id()))
  ));
create policy "nutrition_meals_write" on public.nutrition_meals for all
  using (exists (
    select 1 from public.nutrition_plans np where np.id = nutrition_plan_id
    and (public.is_super_admin() or np.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and np.gym_id = public.current_gym_id()))
  ))
  with check (exists (
    select 1 from public.nutrition_plans np where np.id = nutrition_plan_id
    and (public.is_super_admin() or np.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and np.gym_id = public.current_gym_id()))
  ));

create policy "nutrition_meal_items_select" on public.nutrition_meal_items for select
  using (exists (
    select 1 from public.nutrition_meals nm join public.nutrition_plans np on np.id = nm.nutrition_plan_id
    where nm.id = meal_id
    and (public.is_super_admin() or np.member_id = auth.uid() or np.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and np.gym_id = public.current_gym_id()))
  ));
create policy "nutrition_meal_items_write" on public.nutrition_meal_items for all
  using (exists (
    select 1 from public.nutrition_meals nm join public.nutrition_plans np on np.id = nm.nutrition_plan_id
    where nm.id = meal_id
    and (public.is_super_admin() or np.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and np.gym_id = public.current_gym_id()))
  ))
  with check (exists (
    select 1 from public.nutrition_meals nm join public.nutrition_plans np on np.id = nm.nutrition_plan_id
    where nm.id = meal_id
    and (public.is_super_admin() or np.trainer_id = auth.uid()
         or (public.current_role() = 'gym_owner' and np.gym_id = public.current_gym_id()))
  ));

create policy "trainer_favorite_foods_all" on public.trainer_favorite_foods for all
  using (public.is_super_admin() or trainer_id = auth.uid())
  with check (public.is_super_admin() or trainer_id = auth.uid());

create policy "trainer_food_usage_all" on public.trainer_food_usage for all
  using (public.is_super_admin() or trainer_id = auth.uid())
  with check (public.is_super_admin() or trainer_id = auth.uid());

-- ============================================================================
-- PERMISSION MATRIX ADDITIONS
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('trainer','nutrition_plans','create',true), ('trainer','nutrition_plans','read',true),
  ('trainer','nutrition_plans','update',true), ('trainer','nutrition_plans','delete',true),
  ('gym_owner','nutrition_plans','create',true), ('gym_owner','nutrition_plans','read',true),
  ('gym_owner','nutrition_plans','update',true), ('gym_owner','nutrition_plans','delete',true),
  ('member','nutrition_plans','read',true)
on conflict (role, resource, action) do nothing;

-- ============================================================================
-- SEED — common gym/fitness foods (global, gym_id null)
-- Values are standard per-100g / per-piece / per-serving approximations
-- (USDA FoodData Central / IFCT). Raw and cooked/dry and prepared states are
-- kept as distinct rows since their macros differ meaningfully.
-- ============================================================================

do $$
declare
  f record;
  v_food_id uuid;
begin
  for f in
    select * from (values
      -- name, category, state, default_unit, basis_quantity, basis, calories, protein, carbs, fat, fiber
      ('Chicken Breast', 'protein','raw',   'g', 100, 'per_100g', 120, 22.5, 0,    2.6, 0),
      ('Chicken Breast', 'protein','cooked','g', 100, 'per_100g', 165, 31.0, 0,    3.6, 0),
      ('Eggs (whole)',   'protein','raw',   'egg', 1,  'per_piece', 72,  6.3, 0.4,  4.8, 0),
      ('Egg Whites',     'protein','raw',   'egg', 1,  'per_piece', 17,  3.6, 0.2,  0.1, 0),
      ('Paneer',         'protein','na',    'g', 100, 'per_100g', 265, 18.3, 1.2, 20.8, 0),
      ('Fish (generic fillet)', 'protein','raw',   'g', 100, 'per_100g', 100, 20.0, 0,    1.7, 0),
      ('Fish (generic fillet)', 'protein','cooked','g', 100, 'per_100g', 140, 26.0, 0,    3.0, 0),
      ('Soya Chunks',    'protein','dry',      'g', 100, 'per_100g', 345, 52.0, 33.0, 0.5, 13.0),
      ('Soya Chunks',    'protein','prepared', 'g', 100, 'per_100g', 120, 18.0, 11.0, 0.2, 4.5),
      ('Greek Yogurt',   'protein','na',    'g', 100, 'per_100g', 59,  10.0, 3.6,  0.4, 0),
      ('Whey Protein',   'protein','na',    'scoop', 1, 'per_serving', 120, 24.0, 3.0,  1.5, 0),

      ('Rice',           'carbs','cooked', 'g', 100, 'per_100g', 130, 2.7, 28.0, 0.3, 0.4),
      ('Rice',           'carbs','raw',    'g', 100, 'per_100g', 365, 7.1, 80.0, 0.7, 1.3),
      ('Oats',           'carbs','raw',    'g', 100, 'per_100g', 389, 16.9, 66.0, 6.9, 10.6),
      ('Roti / Chapati', 'carbs','cooked', 'piece', 1, 'per_piece', 104, 3.0, 18.0, 2.5, 2.2),
      ('Idli',           'carbs','cooked', 'piece', 1, 'per_piece', 39,  1.5, 8.0,  0.2, 0.5),
      ('Dosa',           'carbs','cooked', 'piece', 1, 'per_piece', 133, 3.0, 18.0, 5.0, 0.9),
      ('Potato',         'carbs','cooked', 'g', 100, 'per_100g', 87,  1.9, 20.0, 0.1, 1.8),
      ('Sweet Potato',   'carbs','cooked', 'g', 100, 'per_100g', 86,  1.6, 20.0, 0.1, 3.0),

      ('Dal',            'legumes','cooked', 'g', 100, 'per_100g', 116, 9.0, 20.0, 0.4, 7.9),
      ('Chickpeas / Chana', 'legumes','cooked', 'g', 100, 'per_100g', 164, 8.9, 27.4, 2.6, 7.6),
      ('Rajma',          'legumes','cooked', 'g', 100, 'per_100g', 127, 8.7, 22.8, 0.5, 6.4),
      ('Beans',          'legumes','cooked', 'g', 100, 'per_100g', 35,  1.8, 7.0,  0.3, 3.4),

      ('Banana',         'fruits','raw', 'piece', 1, 'per_piece', 105, 1.3, 27.0, 0.4, 3.1),
      ('Apple',          'fruits','raw', 'piece', 1, 'per_piece', 95,  0.5, 25.0, 0.3, 4.4),
      ('Orange',         'fruits','raw', 'piece', 1, 'per_piece', 62,  1.2, 15.4, 0.2, 3.1),
      ('Papaya',         'fruits','raw', 'g', 100, 'per_100g', 43,  0.5, 11.0, 0.3, 1.7),
      ('Mango',          'fruits','raw', 'g', 100, 'per_100g', 60,  0.8, 15.0, 0.4, 1.6),

      ('Mixed Vegetables', 'vegetables','cooked', 'g', 100, 'per_100g', 65, 2.5, 12.0, 0.5, 3.5),
      ('Spinach',           'vegetables','cooked', 'g', 100, 'per_100g', 23, 2.9, 3.6,  0.4, 2.4),
      ('Broccoli',          'vegetables','cooked', 'g', 100, 'per_100g', 35, 2.4, 7.2,  0.4, 3.3),
      ('Cucumber',          'vegetables','raw',    'g', 100, 'per_100g', 15, 0.7, 3.6,  0.1, 0.5),
      ('Tomato',             'vegetables','raw',    'g', 100, 'per_100g', 18, 0.9, 3.9,  0.2, 1.2),
      ('Onion',               'vegetables','raw',    'g', 100, 'per_100g', 40, 1.1, 9.3,  0.1, 1.7),

      ('Milk (whole)',   'dairy','na', 'ml', 100, 'per_100ml', 61,  3.2, 4.8,  3.3, 0),
      ('Milk (toned)',   'dairy','na', 'ml', 100, 'per_100ml', 48,  3.1, 4.9,  1.5, 0),
      ('Curd / Dahi',    'dairy','na', 'g',  100, 'per_100g', 60,  3.5, 4.7,  3.0, 0),
      ('Cheese (cheddar)', 'dairy','na', 'g', 100, 'per_100g', 402, 25.0, 1.3, 33.0, 0),

      ('Peanut Butter',  'other','na', 'g', 100, 'per_100g', 588, 25.0, 20.0, 50.0, 6.0),
      ('Almonds',        'other','raw', 'g', 100, 'per_100g', 579, 21.2, 21.6, 49.9, 12.5),
      ('Olive Oil',      'other','na', 'g', 100, 'per_100g', 884, 0,    0,    100.0, 0)
    ) as t(name, category, state, default_unit, basis_quantity, basis, calories, protein_g, carbs_g, fat_g, fiber_g)
  loop
    insert into public.foods (name, category, state, default_unit, basis_quantity, gym_id, source)
    values (f.name, f.category::public.food_category, f.state::public.food_state, f.default_unit::public.food_unit, f.basis_quantity, null, 'USDA FoodData Central / IFCT (approx.)')
    returning id into v_food_id;

    insert into public.food_nutrition (food_id, basis, calories, protein_g, carbs_g, fat_g, fiber_g, source)
    values (v_food_id, f.basis::public.nutrition_basis, f.calories, f.protein_g, f.carbs_g, f.fat_g, nullif(f.fiber_g, 0), 'USDA FoodData Central / IFCT (approx.)');
  end loop;
end $$;
