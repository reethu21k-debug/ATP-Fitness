-- ============================================================================
-- Auto-seed the standard 1/3/6/12-month plans whenever a new gym is created,
-- so the member registration form always has options — owners can edit
-- pricing or add custom plans afterward from Settings.
-- ============================================================================

create or replace function public.seed_default_membership_plans()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.membership_plans (gym_id, name, duration_days, price, description) values
    (new.id, '1 Month', 30, 1500, 'Monthly membership'),
    (new.id, '3 Months', 90, 4000, 'Quarterly membership — save vs. monthly'),
    (new.id, '6 Months', 180, 7000, 'Half-yearly membership — better value'),
    (new.id, '12 Months', 365, 12000, 'Annual membership — best value');
  return new;
end;
$$;

create trigger trg_seed_default_plans
  after insert on public.gyms
  for each row execute function public.seed_default_membership_plans();
