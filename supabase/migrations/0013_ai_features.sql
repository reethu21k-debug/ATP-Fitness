-- ============================================================================
-- GymOS — Part 8: AI Features
-- Chat history for the AI assistant + cached risk/forecast analysis results
-- (AI calls are not cheap or instant — cache results, refresh on demand)
-- ============================================================================

create type public.ai_chat_role as enum ('user', 'assistant');
create type public.risk_level as enum ('low', 'medium', 'high');

create table public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  role public.ai_chat_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_ai_chat_member on public.ai_chat_messages(member_id, created_at);

create table public.member_risk_scores (
  member_id uuid primary key references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  risk_score int not null check (risk_score between 0 and 100),
  risk_level public.risk_level not null,
  factors jsonb not null default '[]'::jsonb,
  ai_narrative text,
  computed_at timestamptz not null default now()
);

create index idx_risk_scores_gym on public.member_risk_scores(gym_id, risk_score desc);

create table public.revenue_forecasts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  forecast_month date not null,
  projected_revenue numeric(12,2) not null,
  confidence text not null default 'medium', -- low, medium, high
  ai_narrative text,
  computed_at timestamptz not null default now(),
  unique (gym_id, forecast_month)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.ai_chat_messages enable row level security;
alter table public.member_risk_scores enable row level security;
alter table public.revenue_forecasts enable row level security;

create policy "ai_chat_select" on public.ai_chat_messages for select
  using (public.is_super_admin() or member_id = auth.uid() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));
create policy "ai_chat_insert" on public.ai_chat_messages for insert
  with check (public.is_super_admin() or member_id = auth.uid());

create policy "risk_scores_select" on public.member_risk_scores for select
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));
create policy "risk_scores_write" on public.member_risk_scores for all
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));

create policy "forecasts_select" on public.revenue_forecasts for select
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));
create policy "forecasts_write" on public.revenue_forecasts for all
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));
