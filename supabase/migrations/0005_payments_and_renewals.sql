-- ============================================================================
-- GymOS — Part 4: Payments & Renewals
-- ============================================================================

create type public.payment_method as enum ('cash', 'upi', 'card', 'bank', 'split');
create type public.installment_status as enum ('pending', 'paid', 'overdue', 'waived');
create type public.reminder_type as enum (
  'before_30d', 'before_15d', 'before_7d', 'before_3d', 'before_1d',
  'after_1d', 'after_3d', 'after_7d', 'after_30d'
);

-- ============================================================================
-- SEQUENCES for human-friendly, gapless-per-gym invoice/receipt numbers
-- ============================================================================

create table public.gym_number_sequences (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  next_invoice_number int not null default 1,
  next_receipt_number int not null default 1
);

create or replace function public.next_invoice_number(p_gym_id uuid)
returns text
language plpgsql
as $$
declare
  v_num int;
  v_code text;
begin
  insert into public.gym_number_sequences (gym_id) values (p_gym_id)
    on conflict (gym_id) do nothing;

  update public.gym_number_sequences
  set next_invoice_number = next_invoice_number + 1
  where gym_id = p_gym_id
  returning next_invoice_number - 1 into v_num;

  select code into v_code from public.gyms where id = p_gym_id;
  return coalesce(v_code, 'INV') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_num::text, 5, '0');
end;
$$;

create or replace function public.next_receipt_number(p_gym_id uuid)
returns text
language plpgsql
as $$
declare
  v_num int;
  v_code text;
begin
  insert into public.gym_number_sequences (gym_id) values (p_gym_id)
    on conflict (gym_id) do nothing;

  update public.gym_number_sequences
  set next_receipt_number = next_receipt_number + 1
  where gym_id = p_gym_id
  returning next_receipt_number - 1 into v_num;

  select code into v_code from public.gyms where id = p_gym_id;
  return 'RCT-' || coalesce(v_code, 'GX') || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_num::text, 5, '0');
end;
$$;

-- ============================================================================
-- PAYMENTS
-- ============================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.member_memberships(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  gst_rate numeric(5,2) not null default 0,       -- e.g. 18.00 for 18% GST
  gst_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null,             -- amount + gst_amount
  method public.payment_method not null,
  transaction_reference text,                      -- UPI ref / card auth code / bank UTR
  invoice_number text not null,
  receipt_number text not null,
  notes text,
  is_refunded boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_payments_gym on public.payments(gym_id, created_at desc);
create index idx_payments_member on public.payments(member_id);
create index idx_payments_membership on public.payments(membership_id);

-- Split payment breakdown (only populated when method = 'split')
create table public.payment_splits (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(10,2) not null check (amount > 0),
  transaction_reference text
);

create index idx_splits_payment on public.payment_splits(payment_id);

-- ============================================================================
-- REFUNDS
-- ============================================================================

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  reason text not null,
  refunded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_refunds_payment on public.refunds(payment_id);

-- ============================================================================
-- EMI INSTALLMENTS (for memberships paid in installments)
-- ============================================================================

create table public.emi_installments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.member_memberships(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  installment_number int not null,
  due_date date not null,
  amount numeric(10,2) not null,
  status public.installment_status not null default 'pending',
  paid_payment_id uuid references public.payments(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (membership_id, installment_number)
);

create index idx_emi_membership on public.emi_installments(membership_id);
create index idx_emi_due_date on public.emi_installments(due_date) where status in ('pending','overdue');

-- ============================================================================
-- RENEWAL REMINDER LOG (prevents duplicate sends from the scheduled function)
-- ============================================================================

create table public.renewal_reminder_log (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.member_memberships(id) on delete cascade,
  reminder_type public.reminder_type not null,
  sent_at timestamptz not null default now(),
  unique (membership_id, reminder_type)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.gym_number_sequences enable row level security;
alter table public.payments enable row level security;
alter table public.payment_splits enable row level security;
alter table public.refunds enable row level security;
alter table public.emi_installments enable row level security;
alter table public.renewal_reminder_log enable row level security;

create policy "sequences_select" on public.gym_number_sequences for select
  using (public.is_super_admin() or gym_id = public.current_gym_id());

create policy "payments_select" on public.payments for select
  using (
    public.is_super_admin()
    or member_id = auth.uid()
    or (public.is_staff() and gym_id = public.current_gym_id())
  );
create policy "payments_insert" on public.payments for insert
  with check (public.is_super_admin() or (public.has_permission('payments','create') and gym_id = public.current_gym_id()));
create policy "payments_update" on public.payments for update
  using (public.is_super_admin() or (public.current_role() in ('gym_owner') and gym_id = public.current_gym_id()));

create policy "splits_select" on public.payment_splits for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.payments p
      where p.id = payment_id and (p.member_id = auth.uid() or (public.is_staff() and p.gym_id = public.current_gym_id()))
    )
  );
create policy "splits_insert" on public.payment_splits for insert
  with check (
    public.is_super_admin()
    or exists (select 1 from public.payments p where p.id = payment_id and p.gym_id = public.current_gym_id() and public.is_staff())
  );

create policy "refunds_select" on public.refunds for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "refunds_insert" on public.refunds for insert
  with check (public.is_super_admin() or (public.current_role() = 'gym_owner' and gym_id = public.current_gym_id()));

create policy "emi_select" on public.emi_installments for select
  using (
    public.is_super_admin()
    or (public.is_staff() and gym_id = public.current_gym_id())
    or exists (select 1 from public.member_memberships mm where mm.id = membership_id and mm.member_id = auth.uid())
  );
create policy "emi_write" on public.emi_installments for all
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));

create policy "reminder_log_select" on public.renewal_reminder_log for select
  using (public.is_super_admin() or exists (
    select 1 from public.member_memberships mm where mm.id = membership_id and mm.gym_id = public.current_gym_id()
  ));
-- Inserts to the reminder log happen only via the service-role Edge Function.

-- ============================================================================
-- VIEW: payments with member/gym context (for the Payments table UI)
-- ============================================================================

create or replace view public.payments_overview as
select
  pay.id,
  pay.gym_id,
  pay.member_id,
  pr.full_name as member_name,
  pay.membership_id,
  mp.name as plan_name,
  pay.amount,
  pay.gst_rate,
  pay.gst_amount,
  pay.total_amount,
  pay.method,
  pay.invoice_number,
  pay.receipt_number,
  pay.is_refunded,
  pay.created_at
from public.payments pay
join public.profiles pr on pr.id = pay.member_id
left join public.member_memberships mm on mm.id = pay.membership_id
left join public.membership_plans mp on mp.id = mm.plan_id;

alter view public.payments_overview set (security_invoker = true);