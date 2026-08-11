-- ============================================================================
-- GymOS — Part 13: Multi-Branch + Realtime Chat
-- ============================================================================
-- DESIGN NOTE — Multi-branch:
-- Every Server Action and RLS policy written in Parts 1-12 scopes reads/writes
-- through the ACTING USER'S OWN `profiles.gym_id` (via the current_gym_id()
-- helper from Part 1). That is true of ~105 RLS policy references across 10
-- migration files, and of every Server Action that does
-- `const actor = await getCurrentProfile(); ... eq("gym_id", actor.gym_id)`.
--
-- Rather than rewrite that entire surface (high risk, no real benefit), Part
-- 13 makes the gym_owner's *own* `gym_id` switchable between branches they
-- own. Switching branches is just an authenticated self-update of
-- `profiles.gym_id` — already permitted by the Part 1 `profiles_update`
-- policy (`id = auth.uid()`). The moment the owner switches, every existing
-- table, view, RLS policy, and Server Action in the app automatically
-- operates on the newly-selected branch, with zero changes to Parts 1-12.
-- "Separate Data" (per branch) was already true by construction. What Part
-- 13 adds on top: (a) a Branches CRUD module (the `gyms` table's own RLS was
-- ALREADY tenant-scoped, not gym-scoped, for insert/update/delete — so gym
-- owners could already create multiple branches; there was just no UI for
-- it), (b) a branch switcher, and (c) "Combined Analytics" via new
-- SECURITY DEFINER functions that explicitly aggregate across every gym in
-- the caller's tenant (bypassing the normal single-branch RLS scoping on
-- purpose, and only for the tenant the caller actually owns).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BRANCHES: small additive columns to the existing `gyms` table
-- ----------------------------------------------------------------------------
alter table public.gyms
  add column if not exists manager_id uuid references public.profiles(id) on delete set null,
  add column if not exists monthly_revenue_target numeric(12,2);

create index if not exists idx_gyms_manager on public.gyms(manager_id);

-- ----------------------------------------------------------------------------
-- SWITCH ACTIVE BRANCH
-- Server-authoritative: verifies the target gym belongs to the caller's own
-- tenant and that the caller is that tenant's gym_owner before flipping
-- profiles.gym_id. (The Server Action also checks this, but the DB function
-- is the real authority — never trust a client-supplied gym_id alone.)
-- ----------------------------------------------------------------------------
create or replace function public.switch_active_branch(p_gym_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.app_role;
  v_tenant_id uuid;
  v_gym_tenant_id uuid;
begin
  select role, tenant_id into v_role, v_tenant_id from public.profiles where id = auth.uid();

  if v_role is distinct from 'gym_owner' then
    raise exception 'Only a gym owner can switch branches.';
  end if;

  select tenant_id into v_gym_tenant_id from public.gyms where id = p_gym_id;

  if v_gym_tenant_id is null or v_gym_tenant_id <> v_tenant_id then
    raise exception 'That branch does not belong to your gym.';
  end if;

  update public.profiles set gym_id = p_gym_id where id = auth.uid();
end;
$$;

-- ----------------------------------------------------------------------------
-- COMBINED ANALYTICS ACROSS BRANCHES (gym_owner / super_admin only, scoped to
-- the caller's own tenant — never cross-tenant)
-- ----------------------------------------------------------------------------
create or replace function public.tenant_branch_comparison(p_start date, p_end date)
returns table (
  gym_id uuid,
  gym_name text,
  gym_code text,
  is_active boolean,
  member_count bigint,
  active_member_count bigint,
  staff_count bigint,
  revenue numeric,
  attendance_count bigint,
  new_members bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.app_role;
  v_tenant_id uuid;
begin
  select role, tenant_id into v_role, v_tenant_id from public.profiles where id = auth.uid();
  if v_role not in ('gym_owner','super_admin') or v_tenant_id is null then
    raise exception 'Not authorized.';
  end if;

  return query
  select
    g.id,
    g.name,
    g.code,
    g.is_active,
    (select count(*) from public.member_details md where md.gym_id = g.id) as member_count,
    (select count(*) from public.member_details md where md.gym_id = g.id and md.status = 'active') as active_member_count,
    (select count(*) from public.profiles p where p.gym_id = g.id and p.role in ('receptionist','trainer')) as staff_count,
    coalesce((
      select sum(pay.total_amount) from public.payments pay
      where pay.gym_id = g.id and pay.created_at::date between p_start and p_end
    ), 0) - coalesce((
      select sum(r.amount) from public.refunds r
      where r.gym_id = g.id and r.created_at::date between p_start and p_end
    ), 0) as revenue,
    (select count(*) from public.attendance_records ar where ar.gym_id = g.id and ar.check_in_at::date between p_start and p_end) as attendance_count,
    (select count(*) from public.member_details md where md.gym_id = g.id and md.joining_date between p_start and p_end) as new_members
  from public.gyms g
  where g.tenant_id = v_tenant_id
  order by g.created_at asc;
end;
$$;

create or replace function public.tenant_combined_overview()
returns table (
  total_gyms bigint,
  active_gyms bigint,
  total_members bigint,
  active_members bigint,
  total_staff bigint,
  revenue_this_month numeric,
  revenue_last_month numeric
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.app_role;
  v_tenant_id uuid;
begin
  select role, tenant_id into v_role, v_tenant_id from public.profiles where id = auth.uid();
  if v_role not in ('gym_owner','super_admin') or v_tenant_id is null then
    raise exception 'Not authorized.';
  end if;

  return query
  select
    (select count(*) from public.gyms g where g.tenant_id = v_tenant_id) as total_gyms,
    (select count(*) from public.gyms g where g.tenant_id = v_tenant_id and g.is_active) as active_gyms,
    (select count(*) from public.member_details md join public.gyms g on g.id = md.gym_id where g.tenant_id = v_tenant_id) as total_members,
    (select count(*) from public.member_details md join public.gyms g on g.id = md.gym_id where g.tenant_id = v_tenant_id and md.status = 'active') as active_members,
    (select count(*) from public.profiles p where p.tenant_id = v_tenant_id and p.role in ('receptionist','trainer')) as total_staff,
    coalesce((
      select sum(pay.total_amount) from public.payments pay join public.gyms g on g.id = pay.gym_id
      where g.tenant_id = v_tenant_id
        and date_trunc('month', pay.created_at) = date_trunc('month', now())
    ), 0) as revenue_this_month,
    coalesce((
      select sum(pay.total_amount) from public.payments pay join public.gyms g on g.id = pay.gym_id
      where g.tenant_id = v_tenant_id
        and date_trunc('month', pay.created_at) = date_trunc('month', now() - interval '1 month')
    ), 0) as revenue_last_month;
end;
$$;

-- ----------------------------------------------------------------------------
-- CHAT: channels, membership, messages
-- ----------------------------------------------------------------------------
create type public.chat_channel_type as enum ('direct', 'broadcast');
create type public.chat_broadcast_audience as enum ('all_members', 'all_staff', 'all_trainers', 'all_receptionists');

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  type public.chat_channel_type not null,
  name text,                     -- broadcast channels only
  broadcast_audience public.chat_broadcast_audience, -- broadcast channels only
  direct_key text unique,        -- deterministic "sortedId1_sortedId2", direct channels only
  created_by uuid not null references public.profiles(id),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_chat_channels_tenant on public.chat_channels(tenant_id);
create index idx_chat_channels_gym on public.chat_channels(gym_id);

create table public.chat_channel_members (
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  can_send boolean not null default true,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

create index idx_chat_members_profile on public.chat_channel_members(profile_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text,
  attachment_url text,
  attachment_type text,          -- 'image' | 'voice' | 'pdf'
  attachment_public_id text,
  created_at timestamptz not null default now(),
  constraint chat_messages_has_content check (body is not null or attachment_url is not null)
);

create index idx_chat_messages_channel on public.chat_messages(channel_id, created_at);

-- Keep channel's last_message_at fresh so the channel list can sort/preview
-- without a join+aggregate on every render.
create or replace function public.touch_chat_channel_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.chat_channels set last_message_at = new.created_at where id = new.channel_id;
  return new;
end;
$$;

create trigger trg_touch_chat_channel
  after insert on public.chat_messages
  for each row execute function public.touch_chat_channel_on_message();

-- ----------------------------------------------------------------------------
-- get_or_create_direct_channel
-- Server-authoritative pairing rules (per spec: Trainer<->Member, Admin<->Trainer):
--   - member <-> their own assigned_trainer_id
--   - gym_owner <-> any trainer or receptionist in a gym they currently manage
--   - super_admin <-> gym_owner of any tenant (support escalation)
-- ----------------------------------------------------------------------------
create or replace function public.get_or_create_direct_channel(p_other_profile_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles%rowtype;
  v_other public.profiles%rowtype;
  v_key text;
  v_channel_id uuid;
  v_allowed boolean := false;
begin
  select * into v_me from public.profiles where id = auth.uid();
  select * into v_other from public.profiles where id = p_other_profile_id;

  if v_me.id is null or v_other.id is null then
    raise exception 'Profile not found.';
  end if;
  if v_me.id = v_other.id then
    raise exception 'Cannot start a chat with yourself.';
  end if;

  if v_me.role = 'member' and v_other.role = 'trainer' then
    v_allowed := exists (select 1 from public.member_details md where md.profile_id = v_me.id and md.assigned_trainer_id = v_other.id);
  elsif v_me.role = 'trainer' and v_other.role = 'member' then
    v_allowed := exists (select 1 from public.member_details md where md.profile_id = v_other.id and md.assigned_trainer_id = v_me.id);
  elsif v_me.role = 'gym_owner' and v_other.role in ('trainer','receptionist') then
    v_allowed := v_other.tenant_id = v_me.tenant_id;
  elsif v_me.role in ('trainer','receptionist') and v_other.role = 'gym_owner' then
    v_allowed := v_me.tenant_id = v_other.tenant_id;
  elsif v_me.role = 'super_admin' or v_other.role = 'super_admin' then
    v_allowed := (v_me.role = 'super_admin' and v_other.role = 'gym_owner')
              or (v_other.role = 'super_admin' and v_me.role = 'gym_owner');
  end if;

  if not v_allowed then
    raise exception 'You are not allowed to message this person.';
  end if;

  v_key := (select string_agg(id::text, '_' order by id) from (values (v_me.id), (v_other.id)) as t(id));

  select id into v_channel_id from public.chat_channels where direct_key = v_key;

  if v_channel_id is null then
    insert into public.chat_channels (tenant_id, gym_id, type, direct_key, created_by)
    values (coalesce(v_me.tenant_id, v_other.tenant_id), coalesce(v_me.gym_id, v_other.gym_id), 'direct', v_key, v_me.id)
    returning id into v_channel_id;

    insert into public.chat_channel_members (channel_id, profile_id, can_send)
    values (v_channel_id, v_me.id, true), (v_channel_id, v_other.id, true);
  end if;

  return v_channel_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- create_broadcast_channel — gym_owner only, scoped to their active branch
-- ----------------------------------------------------------------------------
create or replace function public.create_broadcast_channel(p_name text, p_audience public.chat_broadcast_audience)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles%rowtype;
  v_channel_id uuid;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.role <> 'gym_owner' or v_me.gym_id is null then
    raise exception 'Only a gym owner can create a broadcast.';
  end if;

  insert into public.chat_channels (tenant_id, gym_id, type, name, broadcast_audience, created_by)
  values (v_me.tenant_id, v_me.gym_id, 'broadcast', p_name, p_audience, v_me.id)
  returning id into v_channel_id;

  insert into public.chat_channel_members (channel_id, profile_id, can_send)
  values (v_channel_id, v_me.id, true);

  insert into public.chat_channel_members (channel_id, profile_id, can_send)
  select v_channel_id, p.id, false
  from public.profiles p
  where p.gym_id = v_me.gym_id
    and p.id <> v_me.id
    and (
      (p_audience = 'all_members' and p.role = 'member')
      or (p_audience = 'all_staff' and p.role in ('trainer','receptionist'))
      or (p_audience = 'all_trainers' and p.role = 'trainer')
      or (p_audience = 'all_receptionists' and p.role = 'receptionist')
    );

  return v_channel_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.chat_channels enable row level security;
alter table public.chat_channel_members enable row level security;
alter table public.chat_messages enable row level security;

create policy "chat_channels_select" on public.chat_channels for select
  using (
    public.is_super_admin()
    or exists (select 1 from public.chat_channel_members m where m.channel_id = id and m.profile_id = auth.uid())
  );
-- No direct insert policy: channels are only ever created through the
-- SECURITY DEFINER functions above, which bypass RLS and enforce the real
-- pairing/audience rules server-side.
create policy "chat_channels_insert_super_admin" on public.chat_channels for insert
  with check (public.is_super_admin());

create policy "chat_members_select" on public.chat_channel_members for select
  using (
    public.is_super_admin()
    or profile_id = auth.uid()
    or exists (select 1 from public.chat_channel_members m2 where m2.channel_id = channel_id and m2.profile_id = auth.uid())
  );
create policy "chat_members_update_own" on public.chat_channel_members for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "chat_messages_select" on public.chat_messages for select
  using (
    public.is_super_admin()
    or exists (select 1 from public.chat_channel_members m where m.channel_id = channel_id and m.profile_id = auth.uid())
  );
create policy "chat_messages_insert" on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_channel_members m
      where m.channel_id = channel_id and m.profile_id = auth.uid() and m.can_send = true
    )
  );

-- ----------------------------------------------------------------------------
-- REALTIME: broadcast Postgres changes on new messages to subscribed clients
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.chat_messages;

-- ----------------------------------------------------------------------------
-- VIEW: chat channel list with computed unread counts + display info
-- ----------------------------------------------------------------------------
create or replace view public.chat_channels_overview as
select
  c.id as channel_id,
  c.tenant_id,
  c.gym_id,
  c.type,
  c.name,
  c.broadcast_audience,
  c.last_message_at,
  c.created_at,
  m.profile_id as viewer_id,
  m.can_send,
  m.last_read_at,
  (
    select count(*) from public.chat_messages msg
    where msg.channel_id = c.id
      and msg.created_at > coalesce(m.last_read_at, 'epoch'::timestamptz)
      and msg.sender_id <> m.profile_id
  ) as unread_count,
  (
    select msg.body from public.chat_messages msg
    where msg.channel_id = c.id order by msg.created_at desc limit 1
  ) as last_message_preview,
  (
    select jsonb_agg(jsonb_build_object('id', op.id, 'full_name', op.full_name, 'avatar_url', op.avatar_url, 'role', op.role))
    from public.chat_channel_members om
    join public.profiles op on op.id = om.profile_id
    where om.channel_id = c.id and om.profile_id <> m.profile_id
  ) as other_participants
from public.chat_channels c
join public.chat_channel_members m on m.channel_id = c.id
where m.profile_id = auth.uid();

alter view public.chat_channels_overview set (security_invoker = true);

-- ============================================================================
-- PERMISSION MATRIX — chat + branches
-- ============================================================================
insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','branches','create',true), ('gym_owner','branches','read',true),
  ('gym_owner','branches','update',true), ('gym_owner','branches','delete',true),
  ('gym_owner','chat','create',true), ('gym_owner','chat','read',true),
  ('trainer','chat','create',true), ('trainer','chat','read',true),
  ('member','chat','create',true), ('member','chat','read',true)
on conflict (role, resource, action) do nothing;
