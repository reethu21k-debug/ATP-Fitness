-- ============================================================================
-- GymOS — Part 10: Marketing
-- Campaigns (WhatsApp/Email), Coupons, Referrals, Audience Segmentation,
-- Birthday/Festival automation, Campaign Analytics
-- ============================================================================

create type public.campaign_channel as enum ('email', 'whatsapp', 'both');
create type public.campaign_audience_type as enum (
  'all_members', 'active_members', 'expired_members', 'expiring_soon',
  'frozen_members', 'leads', 'custom_selection'
);
create type public.campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled');
create type public.campaign_trigger as enum ('manual', 'birthday', 'festival', 'renewal_expiring', 'welcome');
create type public.coupon_discount_type as enum ('percentage', 'flat');
create type public.referral_status as enum ('pending', 'converted', 'rewarded', 'expired');

-- ============================================================================
-- CAMPAIGNS (WhatsApp / Email marketing campaigns)
-- ============================================================================

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  channel public.campaign_channel not null default 'email',
  audience_type public.campaign_audience_type not null default 'all_members',
  audience_member_ids uuid[], -- used only when audience_type = 'custom_selection'
  subject text, -- email subject (ignored for whatsapp-only)
  message_body text not null,
  image_url text, -- optional Cloudinary banner/image for email or WhatsApp media
  trigger_type public.campaign_trigger not null default 'manual',
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz, -- null = send immediately when triggered
  sent_at timestamptz,
  recipients_total int not null default 0,
  recipients_sent int not null default 0,
  recipients_failed int not null default 0,
  opens_count int not null default 0, -- email open tracking (pixel)
  clicks_count int not null default 0, -- link click tracking
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campaigns_gym on public.marketing_campaigns(gym_id);
create index idx_campaigns_status on public.marketing_campaigns(gym_id, status);
create index idx_campaigns_scheduled on public.marketing_campaigns(scheduled_at) where status = 'scheduled';

create trigger trg_campaigns_updated_at before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();

-- Per-recipient send log: lets us show exactly who received a campaign,
-- track delivery failures per person, and support open/click tracking
-- without ever re-sending to someone twice for the same campaign.
create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  recipient_name text not null,
  recipient_email text,
  recipient_phone text,
  channel public.campaign_channel not null,
  status text not null default 'pending', -- pending | sent | failed | opened | clicked
  error_message text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_campaign_recipients_campaign on public.campaign_recipients(campaign_id);
create index idx_campaign_recipients_member on public.campaign_recipients(member_id);
-- one recipient row per member/lead per campaign — prevents duplicate sends
create unique index uq_campaign_recipient_member on public.campaign_recipients(campaign_id, member_id) where member_id is not null;
create unique index uq_campaign_recipient_lead on public.campaign_recipients(campaign_id, lead_id) where lead_id is not null;

-- ============================================================================
-- COUPONS
-- ============================================================================

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  code text not null,
  description text,
  discount_type public.coupon_discount_type not null default 'percentage',
  discount_value numeric(10,2) not null, -- % (0-100) or flat currency amount
  max_discount_amount numeric(10,2), -- caps a percentage discount, optional
  min_purchase_amount numeric(10,2) not null default 0,
  applicable_plan_ids uuid[], -- null/empty = applies to all plans
  usage_limit int, -- total redemptions allowed across all members; null = unlimited
  usage_limit_per_member int not null default 1,
  times_used int not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, code)
);

create index idx_coupons_gym on public.coupons(gym_id);
create index idx_coupons_code on public.coupons(gym_id, code);
create index idx_coupons_active on public.coupons(gym_id) where is_active = true;

create trigger trg_coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  membership_id uuid references public.member_memberships(id) on delete set null,
  discount_applied numeric(10,2) not null,
  redeemed_at timestamptz not null default now()
);

create index idx_coupon_redemptions_coupon on public.coupon_redemptions(coupon_id);
create index idx_coupon_redemptions_member on public.coupon_redemptions(member_id);

-- Keep coupons.times_used in sync automatically, same "ledger drives the
-- counter" pattern used for inventory quantity in Part 9.
create or replace function public.apply_coupon_redemption()
returns trigger
language plpgsql
as $$
begin
  update public.coupons set times_used = times_used + 1 where id = new.coupon_id;
  return new;
end;
$$;

create trigger trg_apply_coupon_redemption
  after insert on public.coupon_redemptions
  for each row execute function public.apply_coupon_redemption();

-- Validates a coupon server-side: existence, active window, usage caps, and
-- (if provided) the per-member usage cap — called from the redeem action so
-- the same rules can never be bypassed by a client-side-only check.
create or replace function public.validate_coupon(
  p_gym_id uuid,
  p_code text,
  p_member_id uuid,
  p_purchase_amount numeric
)
returns table (
  is_valid boolean,
  reason text,
  coupon_id uuid,
  discount_type public.coupon_discount_type,
  discount_value numeric,
  max_discount_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_member_uses int;
begin
  select * into v_coupon from public.coupons
  where gym_id = p_gym_id and code = upper(p_code) and is_active = true;

  if not found then
    return query select false, 'This coupon code is not valid.', null::uuid, null::public.coupon_discount_type, null::numeric, null::numeric;
    return;
  end if;

  if v_coupon.valid_from > now() then
    return query select false, 'This coupon is not active yet.', v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_coupon.max_discount_amount;
    return;
  end if;

  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return query select false, 'This coupon has expired.', v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_coupon.max_discount_amount;
    return;
  end if;

  if v_coupon.usage_limit is not null and v_coupon.times_used >= v_coupon.usage_limit then
    return query select false, 'This coupon has reached its usage limit.', v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_coupon.max_discount_amount;
    return;
  end if;

  if p_purchase_amount < v_coupon.min_purchase_amount then
    return query select false, format('This coupon requires a minimum purchase of %s.', v_coupon.min_purchase_amount), v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_coupon.max_discount_amount;
    return;
  end if;

  select count(*) into v_member_uses from public.coupon_redemptions
  where coupon_id = v_coupon.id and member_id = p_member_id;

  if v_member_uses >= v_coupon.usage_limit_per_member then
    return query select false, 'You have already used this coupon the maximum number of times.', v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_coupon.max_discount_amount;
    return;
  end if;

  return query select true, null::text, v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_coupon.max_discount_amount;
end;
$$;

-- ============================================================================
-- REFERRAL PROGRAM
-- ============================================================================

create table public.referral_program_config (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  is_enabled boolean not null default true,
  referrer_reward_type public.coupon_discount_type not null default 'flat',
  referrer_reward_value numeric(10,2) not null default 0,
  referee_reward_type public.coupon_discount_type not null default 'percentage',
  referee_reward_value numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);

create trigger trg_referral_config_updated_at before update on public.referral_program_config
  for each row execute function public.set_updated_at();

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  referrer_member_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text not null,
  referee_name text,
  referee_phone text,
  referee_member_id uuid references public.profiles(id) on delete set null,
  status public.referral_status not null default 'pending',
  referrer_reward_coupon_id uuid references public.coupons(id) on delete set null,
  referee_reward_coupon_id uuid references public.coupons(id) on delete set null,
  converted_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (gym_id, referral_code)
);

create index idx_referrals_gym on public.referrals(gym_id);
create index idx_referrals_referrer on public.referrals(referrer_member_id);
create index idx_referrals_status on public.referrals(gym_id, status);

-- Every active member gets a stable, human-shareable referral code the
-- moment they're created, so "referred by" links always resolve to a code
-- rather than requiring staff to generate one manually first.
create or replace function public.get_or_create_referral_code(p_member_id uuid, p_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_full_name text;
begin
  select referral_code into v_code from public.referrals
  where referrer_member_id = p_member_id and gym_id = p_gym_id and referee_member_id is null
  limit 1;

  if v_code is not null then
    return v_code;
  end if;

  select full_name into v_full_name from public.profiles where id = p_member_id;
  v_code := upper(regexp_replace(coalesce(split_part(v_full_name, ' ', 1), 'MEMBER'), '[^a-zA-Z]', '', 'g'));
  v_code := left(v_code, 6) || left(replace(p_member_id::text, '-', ''), 4);
  v_code := upper(v_code);

  insert into public.referrals (gym_id, referrer_member_id, referral_code, status)
  values (p_gym_id, p_member_id, v_code, 'pending')
  on conflict (gym_id, referral_code) do nothing;

  return v_code;
end;
$$;

-- ============================================================================
-- AUDIENCE SEGMENTS (saved, reusable filters for campaign targeting)
-- ============================================================================

create table public.audience_segments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  audience_type public.campaign_audience_type not null,
  filters jsonb not null default '{}'::jsonb, -- e.g. {"expiringWithinDays": 7, "planIds": [...]}
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_segments_gym on public.audience_segments(gym_id);

-- ============================================================================
-- BIRTHDAY / FESTIVAL AUTOMATED OFFERS
-- ============================================================================

create table public.festival_offers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null, -- e.g. "New Year Offer", "Diwali Special"
  occurs_on date not null, -- month/day matters; year is ignored at send time
  message_template text not null,
  channel public.campaign_channel not null default 'both',
  coupon_id uuid references public.coupons(id) on delete set null,
  is_active boolean not null default true,
  last_sent_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_festival_offers_gym on public.festival_offers(gym_id);

create trigger trg_festival_offers_updated_at before update on public.festival_offers
  for each row execute function public.set_updated_at();

-- Per-gym toggle + template for automatic birthday wishes, sent by the
-- marketing-automation Edge Function.
create table public.birthday_campaign_config (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  is_enabled boolean not null default true,
  channel public.campaign_channel not null default 'both',
  message_template text not null default 'Happy Birthday, {{name}}! 🎉 Wishing you strength and health this year. Team {{gym_name}}',
  coupon_id uuid references public.coupons(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger trg_birthday_config_updated_at before update on public.birthday_campaign_config
  for each row execute function public.set_updated_at();

-- Idempotency log so the daily automation function never sends the same
-- birthday/festival wish twice for the same person on the same calendar day.
create table public.automated_message_log (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete cascade,
  automation_type text not null, -- 'birthday' | 'festival:<festival_offer_id>'
  sent_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (gym_id, member_id, automation_type, sent_on)
);

create index idx_automated_log_lookup on public.automated_message_log(gym_id, automation_type, sent_on);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.marketing_campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.referral_program_config enable row level security;
alter table public.referrals enable row level security;
alter table public.audience_segments enable row level security;
alter table public.festival_offers enable row level security;
alter table public.birthday_campaign_config enable row level security;
alter table public.automated_message_log enable row level security;

-- Campaigns: staff (owner/reception) can read; only marketing-permitted
-- roles can write. Members/trainers have no access — campaigns are an
-- internal marketing tool, not member-facing data.
create policy "campaigns_select" on public.marketing_campaigns for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "campaigns_insert" on public.marketing_campaigns for insert
  with check (public.is_super_admin() or (public.has_permission('marketing','create') and gym_id = public.current_gym_id()));
create policy "campaigns_update" on public.marketing_campaigns for update
  using (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()));
create policy "campaigns_delete" on public.marketing_campaigns for delete
  using (public.is_super_admin() or (public.has_permission('marketing','delete') and gym_id = public.current_gym_id()));

create policy "campaign_recipients_select" on public.campaign_recipients for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "campaign_recipients_insert" on public.campaign_recipients for insert
  with check (public.is_super_admin() or (public.has_permission('marketing','create') and gym_id = public.current_gym_id()));
create policy "campaign_recipients_update" on public.campaign_recipients for update
  using (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()));

-- Coupons: staff can manage; members can read active coupons for their own
-- gym so a "have a code?" field at checkout can validate client-side hints
-- (the actual authoritative check is always the validate_coupon() RPC).
create policy "coupons_select" on public.coupons for select
  using (
    public.is_super_admin()
    or (public.is_staff() and gym_id = public.current_gym_id())
    or (public.current_role() = 'member' and gym_id = public.current_gym_id() and is_active = true)
  );
create policy "coupons_insert" on public.coupons for insert
  with check (public.is_super_admin() or (public.has_permission('marketing','create') and gym_id = public.current_gym_id()));
create policy "coupons_update" on public.coupons for update
  using (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()));
create policy "coupons_delete" on public.coupons for delete
  using (public.is_super_admin() or (public.has_permission('marketing','delete') and gym_id = public.current_gym_id()));

create policy "coupon_redemptions_select" on public.coupon_redemptions for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()) or member_id = auth.uid());
create policy "coupon_redemptions_insert" on public.coupon_redemptions for insert
  with check (public.is_super_admin() or gym_id = public.current_gym_id());

-- Referral config: staff manage, members can read (to know their reward).
create policy "referral_config_select" on public.referral_program_config for select
  using (public.is_super_admin() or gym_id = public.current_gym_id());
create policy "referral_config_write" on public.referral_program_config for all
  using (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()));

-- Referrals: staff see all in their gym; a member can see referrals they made.
create policy "referrals_select" on public.referrals for select
  using (
    public.is_super_admin()
    or (public.is_staff() and gym_id = public.current_gym_id())
    or referrer_member_id = auth.uid()
  );
create policy "referrals_insert" on public.referrals for insert
  with check (
    public.is_super_admin()
    or (public.is_staff() and gym_id = public.current_gym_id())
    or (referrer_member_id = auth.uid() and gym_id = public.current_gym_id())
  );
create policy "referrals_update" on public.referrals for update
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));

create policy "segments_all" on public.audience_segments for all
  using (public.is_super_admin() or (public.has_permission('marketing','read') and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.has_permission('marketing','create') and gym_id = public.current_gym_id()));

create policy "festival_offers_select" on public.festival_offers for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "festival_offers_write" on public.festival_offers for all
  using (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()));

create policy "birthday_config_select" on public.birthday_campaign_config for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
create policy "birthday_config_write" on public.birthday_campaign_config for all
  using (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()))
  with check (public.is_super_admin() or (public.has_permission('marketing','update') and gym_id = public.current_gym_id()));

create policy "automated_log_select" on public.automated_message_log for select
  using (public.is_super_admin() or (public.is_staff() and gym_id = public.current_gym_id()));
-- Inserts to automated_message_log come only from the service-role Edge
-- Function (bypasses RLS); no client-side insert policy is defined on purpose.

-- ============================================================================
-- PERMISSION MATRIX
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','marketing','create',true), ('gym_owner','marketing','read',true),
  ('gym_owner','marketing','update',true), ('gym_owner','marketing','delete',true),
  ('receptionist','marketing','create',false), ('receptionist','marketing','read',true),
  ('receptionist','marketing','update',false), ('receptionist','marketing','delete',false)
on conflict (role, resource, action) do nothing;

-- ============================================================================
-- COUNTER INCREMENT RPC (for the public, unauthenticated tracking routes)
-- ============================================================================

-- Used by the open-tracking pixel and click-tracking redirect routes, which
-- run with no user session (an email client fetching an image has none), so
-- they use the admin client — this RPC keeps the increment atomic and column
-- name whitelisted rather than letting a route build dynamic SQL.
create or replace function public.increment_campaign_counter(p_campaign_id uuid, p_column text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_column = 'opens_count' then
    update public.marketing_campaigns set opens_count = opens_count + 1 where id = p_campaign_id;
  elsif p_column = 'clicks_count' then
    update public.marketing_campaigns set clicks_count = clicks_count + 1 where id = p_campaign_id;
  end if;
end;
$$;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Campaign analytics: delivery + engagement rates computed once, not
-- recalculated ad hoc in every UI that shows campaign performance.
create or replace view public.campaign_analytics as
select
  c.id,
  c.gym_id,
  c.name,
  c.channel,
  c.status,
  c.trigger_type,
  c.scheduled_at,
  c.sent_at,
  c.recipients_total,
  c.recipients_sent,
  c.recipients_failed,
  c.opens_count,
  c.clicks_count,
  case when c.recipients_sent > 0 then round((c.opens_count::numeric / c.recipients_sent) * 100, 1) else 0 end as open_rate,
  case when c.recipients_sent > 0 then round((c.clicks_count::numeric / c.recipients_sent) * 100, 1) else 0 end as click_rate,
  case when c.recipients_total > 0 then round((c.recipients_sent::numeric / c.recipients_total) * 100, 1) else 0 end as delivery_rate,
  c.created_at
from public.marketing_campaigns c;

alter view public.campaign_analytics set (security_invoker = true);

-- Referral overview: joins referrer/referee names so the UI never has to
-- do client-side joins across profiles.
create or replace view public.referrals_overview as
select
  r.id,
  r.gym_id,
  r.referrer_member_id,
  rp.full_name as referrer_name,
  r.referral_code,
  r.referee_name,
  r.referee_phone,
  r.referee_member_id,
  refp.full_name as referee_actual_name,
  r.status,
  r.referrer_reward_coupon_id,
  r.referee_reward_coupon_id,
  r.converted_at,
  r.rewarded_at,
  r.created_at
from public.referrals r
join public.profiles rp on rp.id = r.referrer_member_id
left join public.profiles refp on refp.id = r.referee_member_id;

alter view public.referrals_overview set (security_invoker = true);

-- Coupon overview with a computed "is_expired" flag, mirroring the
-- inventory_overview computed-flag pattern from Part 9.
create or replace view public.coupons_overview as
select
  c.*,
  (c.valid_until is not null and c.valid_until < now()) as is_expired,
  (c.usage_limit is not null and c.times_used >= c.usage_limit) as is_exhausted
from public.coupons c;

alter view public.coupons_overview set (security_invoker = true);
