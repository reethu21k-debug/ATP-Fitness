-- ============================================================================
-- GymOS — Part 9: Inventory & Payroll
-- ============================================================================

create type public.inventory_category as enum ('equipment', 'supplement', 'accessory', 'other');
create type public.inventory_txn_type as enum ('restock', 'sale', 'adjustment', 'damage');
create type public.payslip_status as enum ('draft', 'finalized', 'paid');

-- ============================================================================
-- INVENTORY
-- ============================================================================

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  category public.inventory_category not null default 'equipment',
  barcode text,
  quantity int not null default 0,
  unit text not null default 'piece',
  cost_price numeric(10,2),
  sell_price numeric(10,2),
  low_stock_threshold int not null default 5,
  expiry_date date,
  supplier text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_inventory_gym on public.inventory_items(gym_id);
create index idx_inventory_barcode on public.inventory_items(gym_id, barcode) where barcode is not null;
create index idx_inventory_low_stock on public.inventory_items(gym_id) where quantity <= low_stock_threshold;
create index idx_inventory_expiry on public.inventory_items(gym_id, expiry_date) where expiry_date is not null;

create trigger trg_inventory_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  type public.inventory_txn_type not null,
  quantity_change int not null, -- positive for restock, negative for sale/damage
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_inventory_txn_item on public.inventory_transactions(item_id, created_at desc);

-- Keep item.quantity in sync automatically — the single source of truth for
-- "current stock" is the sum of transactions, applied via trigger so the UI
-- never has to remember to update both.
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
as $$
begin
  update public.inventory_items
  set quantity = quantity + new.quantity_change
  where id = new.item_id;
  return new;
end;
$$;

create trigger trg_apply_inventory_transaction
  after insert on public.inventory_transactions
  for each row execute function public.apply_inventory_transaction();

-- ============================================================================
-- PAYROLL
-- ============================================================================

create table public.staff_salary_config (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  base_salary numeric(10,2) not null default 0,
  commission_rate numeric(5,2) not null default 0, -- % of payments they processed/generated
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  unique (staff_id)
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  month date not null, -- first day of the month this payslip covers
  base_salary numeric(10,2) not null default 0,
  commission_amount numeric(10,2) not null default 0,
  bonus_amount numeric(10,2) not null default 0,
  deductions_amount numeric(10,2) not null default 0,
  present_days int,
  total_working_days int,
  net_pay numeric(10,2) not null default 0,
  status public.payslip_status not null default 'draft',
  notes text,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (gym_id, staff_id, month)
);

create index idx_payslips_gym_month on public.payslips(gym_id, month desc);
create index idx_payslips_staff on public.payslips(staff_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.staff_salary_config enable row level security;
alter table public.payslips enable row level security;

create policy "inventory_select" on public.inventory_items for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "inventory_insert" on public.inventory_items for insert
  with check (public.is_super_admin() or (public.has_permission('inventory','create') and gym_id = public.current_gym_id()));
create policy "inventory_update" on public.inventory_items for update
  using (public.is_super_admin() or (public.has_permission('inventory','update') and gym_id = public.current_gym_id()));
create policy "inventory_delete" on public.inventory_items for delete
  using (public.is_super_admin() or (public.has_permission('inventory','delete') and gym_id = public.current_gym_id()));

create policy "inventory_txn_select" on public.inventory_transactions for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "inventory_txn_insert" on public.inventory_transactions for insert
  with check (public.is_super_admin() or (public.has_permission('inventory','update') and gym_id = public.current_gym_id()));

-- Payroll is gym-owner only — salary data is sensitive.
create policy "salary_config_select" on public.staff_salary_config for select
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()) or staff_id = auth.uid());
create policy "salary_config_write" on public.staff_salary_config for all
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));

create policy "payslips_select" on public.payslips for select
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()) or staff_id = auth.uid());
create policy "payslips_write" on public.payslips for all
  using (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));

-- ============================================================================
-- PERMISSION MATRIX
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','inventory','create',true), ('gym_owner','inventory','read',true),
  ('gym_owner','inventory','update',true), ('gym_owner','inventory','delete',true),
  ('receptionist','inventory','create',true), ('receptionist','inventory','read',true),
  ('receptionist','inventory','update',true), ('receptionist','inventory','delete',false)
on conflict (role, resource, action) do nothing;

-- ============================================================================
-- VIEW: inventory with computed low-stock / expiring flags
-- ============================================================================

create or replace view public.inventory_overview as
select
  i.*,
  (i.quantity <= i.low_stock_threshold) as is_low_stock,
  (i.expiry_date is not null and i.expiry_date <= current_date + interval '30 days') as is_expiring_soon
from public.inventory_items i
where i.is_active = true;

alter view public.inventory_overview set (security_invoker = true);
