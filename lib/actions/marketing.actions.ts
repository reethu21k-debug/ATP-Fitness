"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission, requireRole, PermissionError } from "@/lib/utils/permissions";
import { computeDiscountAmount } from "@/lib/utils/marketing-helpers";
import { dispatchCampaign } from "@/lib/services/marketing-dispatch";
import type { ActionResult } from "./auth.actions";
import type {
  CampaignChannel,
  CampaignAudienceType,
  CampaignTrigger,
  CouponDiscountType,
} from "@/types/database";

const MARKETING_PATHS = ["/dashboard/owner/marketing", "/dashboard/reception/marketing"];
function revalidateMarketing() {
  for (const path of MARKETING_PATHS) revalidatePath(path);
}

// ============================================================================
// CAMPAIGNS
// ============================================================================
export interface CreateCampaignInput {
  name: string;
  channel: CampaignChannel;
  audienceType: CampaignAudienceType;
  audienceMemberIds?: string[];
  subject?: string;
  messageBody: string;
  imageUrl?: string;
  triggerType?: CampaignTrigger;
  scheduledAt?: string; // ISO timestamp; omit to send immediately
  sendNow?: boolean;
}

export async function createCampaign(input: CreateCampaignInput): Promise<ActionResult<{ campaignId: string }>> {
  try {
    await requirePermission("marketing", "create");
  } catch {
    return { success: false, error: "You do not have permission to create campaigns." };
  }

  if (!input.name.trim()) return { success: false, error: "Give this campaign a name." };
  if (!input.messageBody.trim()) return { success: false, error: "The message body can't be empty." };
  if (input.audienceType === "custom_selection" && !input.audienceMemberIds?.length) {
    return { success: false, error: "Select at least one member for a custom audience." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  // NOTE: even for sendNow, the row starts as "draft" -- dispatchCampaign()
  // is the single place that transitions a campaign into "sending" (and
  // then "sent"). It also uses "sending" as a guard against double-sends,
  // so if we set that status here first, dispatchCampaign sees the row
  // already "sending" and skips it -- the campaign gets stuck showing
  // "Sending" forever with 0/0 recipients and nothing actually goes out.
  const status = input.scheduledAt ? "scheduled" : "draft";

  const { data: campaign, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      gym_id: actor.gym_id,
      name: input.name,
      channel: input.channel,
      audience_type: input.audienceType,
      audience_member_ids: input.audienceType === "custom_selection" ? input.audienceMemberIds : null,
      subject: input.subject || null,
      message_body: input.messageBody,
      image_url: input.imageUrl || null,
      trigger_type: input.triggerType ?? "manual",
      status,
      scheduled_at: input.scheduledAt || null,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error || !campaign) return { success: false, error: "Could not create this campaign." };

  if (input.sendNow && !input.scheduledAt) {
    const dispatchResult = await dispatchCampaignNow(campaign.id);
    if (!dispatchResult.success) {
      // Campaign row still exists as "sending" — surface the error but don't
      // roll back, since a partial send may already have gone out.
      return { success: false, error: dispatchResult.error };
    }
  }

  revalidateMarketing();
  return { success: true, data: { campaignId: campaign.id } };
}

/**
 * Sends a campaign immediately, in-process, through the same Gmail SMTP
 * transport used for subscription/welcome emails (lib/services/email.ts).
 * No Resend, no separate Edge Function -- see lib/services/marketing-dispatch.ts.
 */
async function dispatchCampaignNow(campaignId: string): Promise<ActionResult> {
  try {
    const admin = createAdminClient();
    const result = await dispatchCampaign(admin, campaignId);
    if (result.error) return { success: false, error: result.error };
    // Defense in depth: if dispatchCampaign ever reports "skipped" here, treat
    // it as a failure instead of silently reporting success -- a skip means
    // no email/WhatsApp actually went out.
    if (result.skipped) return { success: false, error: `Campaign was not sent (${result.reason ?? "already in progress"}).` };
    return { success: true };
  } catch (err) {
    console.error(`marketing: dispatchCampaignNow failed for campaign ${campaignId}:`, err);
    return { success: false, error: "Could not send this campaign. Check the server logs for details." };
  }
}

export async function sendCampaignNow(campaignId: string): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to send campaigns." };
  }

  // dispatchCampaign() (via dispatchCampaignNow) sets status to "sending"
  // itself once it confirms the campaign isn't already sending/sent -- see
  // the note in createCampaign() above for why setting it here first would
  // cause the send to be skipped.
  const result = await dispatchCampaignNow(campaignId);
  revalidateMarketing();
  return result;
}

export async function cancelScheduledCampaign(campaignId: string): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to modify campaigns." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ status: "cancelled" })
    .eq("id", campaignId)
    .eq("status", "scheduled"); // can only cancel campaigns that haven't sent yet

  if (error) return { success: false, error: "Could not cancel this campaign." };
  revalidateMarketing();
  return { success: true };
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not permitted." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("marketing_campaigns").delete().eq("id", campaignId);
  if (error) return { success: false, error: "Could not delete this campaign." };
  revalidateMarketing();
  return { success: true };
}

export async function listCampaigns() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_analytics")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getCampaignDetail(campaignId: string) {
  const supabase = await createClient();
  const [{ data: campaign }, { data: recipients }] = await Promise.all([
    supabase.from("campaign_analytics").select("*").eq("id", campaignId).single(),
    supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  return { campaign, recipients: recipients ?? [] };
}

export async function estimateAudienceSize(
  audienceType: CampaignAudienceType,
  customMemberIds?: string[]
): Promise<number> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return 0;

  const supabase = await createClient();

  if (audienceType === "custom_selection") return customMemberIds?.length ?? 0;

  if (audienceType === "leads") {
    const { count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", actor.gym_id)
      .not("status", "in", "(converted,lost)");
    return count ?? 0;
  }

  if (audienceType === "expiring_soon") {
    const { count } = await supabase
      .from("members_overview")
      .select("*", { count: "exact", head: true })
      .eq("gym_id", actor.gym_id)
      .gte("days_until_expiry", 0)
      .lte("days_until_expiry", 7);
    return count ?? 0;
  }

  let query = supabase.from("member_details").select("*", { count: "exact", head: true }).eq("gym_id", actor.gym_id);
  if (audienceType === "active_members") query = query.eq("status", "active");
  else if (audienceType === "expired_members") query = query.eq("status", "expired");
  else if (audienceType === "frozen_members") query = query.eq("status", "frozen");

  const { count } = await query;
  return count ?? 0;
}

// ============================================================================
// COUPONS
// ============================================================================
export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minPurchaseAmount?: number;
  applicablePlanIds?: string[];
  usageLimit?: number;
  usageLimitPerMember?: number;
  validFrom?: string;
  validUntil?: string;
}

export async function createCoupon(input: CreateCouponInput): Promise<ActionResult<{ couponId: string }>> {
  try {
    await requirePermission("marketing", "create");
  } catch {
    return { success: false, error: "You do not have permission to create coupons." };
  }

  if (!input.code.trim()) return { success: false, error: "Enter a coupon code." };
  if (input.discountValue <= 0) return { success: false, error: "Discount value must be greater than zero." };
  if (input.discountType === "percentage" && input.discountValue > 100) {
    return { success: false, error: "A percentage discount can't exceed 100%." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data: coupon, error } = await supabase
    .from("coupons")
    .insert({
      gym_id: actor.gym_id,
      code: input.code.trim().toUpperCase(),
      description: input.description || null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      max_discount_amount: input.maxDiscountAmount ?? null,
      min_purchase_amount: input.minPurchaseAmount ?? 0,
      applicable_plan_ids: input.applicablePlanIds?.length ? input.applicablePlanIds : null,
      usage_limit: input.usageLimit ?? null,
      usage_limit_per_member: input.usageLimitPerMember ?? 1,
      valid_from: input.validFrom || new Date().toISOString(),
      valid_until: input.validUntil || null,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "A coupon with this code already exists." };
    return { success: false, error: "Could not create this coupon." };
  }

  revalidateMarketing();
  return { success: true, data: { couponId: coupon.id } };
}

export async function updateCouponStatus(couponId: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to modify coupons." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ is_active: isActive }).eq("id", couponId);
  if (error) return { success: false, error: "Could not update this coupon." };
  revalidateMarketing();
  return { success: true };
}

export async function deleteCoupon(couponId: string): Promise<ActionResult> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not permitted." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", couponId);
  if (error) return { success: false, error: "Could not delete this coupon." };
  revalidateMarketing();
  return { success: true };
}

export async function listCoupons() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("coupons_overview")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Validates a coupon code for a specific member + purchase amount, via the
 * server-side validate_coupon() SQL function — this is the single source of
 * truth for whether a coupon can be applied, so a receptionist's checkout
 * screen and any future member-facing checkout both call the same rules.
 */
export async function validateCoupon(
  code: string,
  memberId: string,
  purchaseAmount: number
): Promise<ActionResult<{ couponId: string; discountAmount: number }>> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("validate_coupon", {
      p_gym_id: actor.gym_id,
      p_code: code.trim().toUpperCase(),
      p_member_id: memberId,
      p_purchase_amount: purchaseAmount,
    })
    .single();

  const result = data as {
    is_valid: boolean;
    reason: string | null;
    coupon_id: string | null;
    discount_type: CouponDiscountType | null;
    discount_value: number | null;
    max_discount_amount: number | null;
  } | null;

  if (error || !result) return { success: false, error: "Could not validate this coupon." };
  if (!result.is_valid) return { success: false, error: result.reason ?? "This coupon can't be applied." };

  const discountAmount = computeDiscountAmount({
    discountType: result.discount_type as CouponDiscountType,
    discountValue: Number(result.discount_value),
    maxDiscountAmount: result.max_discount_amount != null ? Number(result.max_discount_amount) : null,
    purchaseAmount,
  });

  return { success: true, data: { couponId: result.coupon_id as string, discountAmount } };
}

/** Records a redemption after a coupon has already been validated and a payment made. */
export async function redeemCoupon(input: {
  couponId: string;
  memberId: string;
  discountApplied: number;
  paymentId?: string;
  membershipId?: string;
}): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { error } = await supabase.from("coupon_redemptions").insert({
    coupon_id: input.couponId,
    gym_id: actor.gym_id,
    member_id: input.memberId,
    payment_id: input.paymentId || null,
    membership_id: input.membershipId || null,
    discount_applied: input.discountApplied,
  });

  if (error) return { success: false, error: "Could not record this coupon redemption." };
  revalidateMarketing();
  return { success: true };
}

// ============================================================================
// REFERRAL PROGRAM
// ============================================================================
export async function getReferralConfig() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("referral_program_config").select("*").eq("gym_id", actor.gym_id).maybeSingle();
  return data;
}

export interface UpdateReferralConfigInput {
  isEnabled: boolean;
  referrerRewardType: CouponDiscountType;
  referrerRewardValue: number;
  refereeRewardType: CouponDiscountType;
  refereeRewardValue: number;
}

export async function updateReferralConfig(input: UpdateReferralConfigInput): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to change the referral program." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { error } = await supabase.from("referral_program_config").upsert({
    gym_id: actor.gym_id,
    is_enabled: input.isEnabled,
    referrer_reward_type: input.referrerRewardType,
    referrer_reward_value: input.referrerRewardValue,
    referee_reward_type: input.refereeRewardType,
    referee_reward_value: input.refereeRewardValue,
  });

  if (error) return { success: false, error: "Could not save the referral program settings." };
  revalidateMarketing();
  return { success: true };
}

export async function listReferrals() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("referrals_overview")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/** Gets (or lazily creates) the current member's own shareable referral code. */
export async function getMyReferralCode(): Promise<{ code: string } | null> {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "member" || !actor.gym_id) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_referral_code", {
    p_member_id: actor.id,
    p_gym_id: actor.gym_id,
  });

  if (error || !data) return null;
  return { code: data as string };
}

/** Front-desk logs a new walk-in/lead as referred by an existing member's code. */
export async function logReferral(input: { referralCode: string; refereeName: string; refereePhone: string }): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("referrals")
    .select("id, referrer_member_id, referee_member_id")
    .eq("gym_id", actor.gym_id)
    .eq("referral_code", input.referralCode.trim().toUpperCase())
    .maybeSingle();

  if (!existing) return { success: false, error: "That referral code wasn't found." };
  if (existing.referee_member_id) return { success: false, error: "This referral code has already been used." };

  const { error } = await supabase
    .from("referrals")
    .update({ referee_name: input.refereeName, referee_phone: input.refereePhone })
    .eq("id", existing.id);

  if (error) return { success: false, error: "Could not log this referral." };
  revalidateMarketing();
  return { success: true };
}

/**
 * Marks a referral converted once the referred person becomes a paying
 * member, and issues both reward coupons (referrer + referee) per the gym's
 * configured referral_program_config — called from convertLeadToMember-style
 * flows once a referred lead signs up.
 */
export async function completeReferral(referralCode: string, refereeMemberId: string): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .eq("referral_code", referralCode.trim().toUpperCase())
    .maybeSingle();

  if (!referral || referral.status !== "pending") {
    return { success: false, error: "This referral code is invalid or already used." };
  }

  const { data: config } = await supabase
    .from("referral_program_config")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .maybeSingle();

  let referrerCouponId: string | null = null;
  let refereeCouponId: string | null = null;

  if (config?.is_enabled) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 90); // referral rewards valid for 90 days

    const { data: referrerCoupon } = await supabase
      .from("coupons")
      .insert({
        gym_id: actor.gym_id,
        code: `REF-${referral.referral_code}-R`,
        description: `Referral reward for referring a new member`,
        discount_type: config.referrer_reward_type,
        discount_value: config.referrer_reward_value,
        usage_limit: 1,
        usage_limit_per_member: 1,
        valid_until: expiry.toISOString(),
      })
      .select("id")
      .single();
    referrerCouponId = referrerCoupon?.id ?? null;

    const { data: refereeCoupon } = await supabase
      .from("coupons")
      .insert({
        gym_id: actor.gym_id,
        code: `REF-${referral.referral_code}-E`,
        description: `Welcome referral discount`,
        discount_type: config.referee_reward_type,
        discount_value: config.referee_reward_value,
        usage_limit: 1,
        usage_limit_per_member: 1,
        valid_until: expiry.toISOString(),
      })
      .select("id")
      .single();
    refereeCouponId = refereeCoupon?.id ?? null;
  }

  const { error } = await supabase
    .from("referrals")
    .update({
      status: config?.is_enabled ? "rewarded" : "converted",
      referee_member_id: refereeMemberId,
      referrer_reward_coupon_id: referrerCouponId,
      referee_reward_coupon_id: refereeCouponId,
      converted_at: new Date().toISOString(),
      rewarded_at: config?.is_enabled ? new Date().toISOString() : null,
    })
    .eq("id", referral.id);

  if (error) return { success: false, error: "Could not complete this referral." };
  revalidateMarketing();
  return { success: true };
}

// ============================================================================
// AUDIENCE SEGMENTS
// ============================================================================
export async function createSegment(input: {
  name: string;
  audienceType: CampaignAudienceType;
  filters?: Record<string, unknown>;
}): Promise<ActionResult<{ segmentId: string }>> {
  try {
    await requirePermission("marketing", "create");
  } catch {
    return { success: false, error: "You do not have permission to create segments." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audience_segments")
    .insert({
      gym_id: actor.gym_id,
      name: input.name,
      audience_type: input.audienceType,
      filters: input.filters ?? {},
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: "Could not save this segment." };
  revalidateMarketing();
  return { success: true, data: { segmentId: data.id } };
}

export async function listSegments() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function deleteSegment(segmentId: string): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to remove segments." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("audience_segments").delete().eq("id", segmentId);
  if (error) return { success: false, error: "Could not remove this segment." };
  revalidateMarketing();
  return { success: true };
}

// ============================================================================
// FESTIVAL OFFERS + BIRTHDAY CONFIG
// ============================================================================
export interface CreateFestivalOfferInput {
  name: string;
  occursOn: string; // date, e.g. "2026-10-20" — year is ignored by the automation
  messageTemplate: string;
  channel: CampaignChannel;
  couponId?: string;
}

export async function createFestivalOffer(input: CreateFestivalOfferInput): Promise<ActionResult<{ offerId: string }>> {
  try {
    await requirePermission("marketing", "create");
  } catch {
    return { success: false, error: "You do not have permission to create festival offers." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("festival_offers")
    .insert({
      gym_id: actor.gym_id,
      name: input.name,
      occurs_on: input.occursOn,
      message_template: input.messageTemplate,
      channel: input.channel,
      coupon_id: input.couponId || null,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: "Could not create this festival offer." };
  revalidateMarketing();
  return { success: true, data: { offerId: data.id } };
}

export async function toggleFestivalOffer(offerId: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to modify festival offers." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("festival_offers").update({ is_active: isActive }).eq("id", offerId);
  if (error) return { success: false, error: "Could not update this festival offer." };
  revalidateMarketing();
  return { success: true };
}

export async function deleteFestivalOffer(offerId: string): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to remove festival offers." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("festival_offers").delete().eq("id", offerId);
  if (error) return { success: false, error: "Could not remove this festival offer." };
  revalidateMarketing();
  return { success: true };
}

export async function listFestivalOffers() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("festival_offers")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("occurs_on");

  return data ?? [];
}

export async function getBirthdayConfig() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("birthday_campaign_config")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .maybeSingle();

  return data;
}

export interface UpdateBirthdayConfigInput {
  isEnabled: boolean;
  channel: CampaignChannel;
  messageTemplate: string;
  couponId?: string;
}

export async function updateBirthdayConfig(input: UpdateBirthdayConfigInput): Promise<ActionResult> {
  try {
    await requirePermission("marketing", "update");
  } catch {
    return { success: false, error: "You do not have permission to change birthday settings." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { error } = await supabase.from("birthday_campaign_config").upsert({
    gym_id: actor.gym_id,
    is_enabled: input.isEnabled,
    channel: input.channel,
    message_template: input.messageTemplate,
    coupon_id: input.couponId || null,
  });

  if (error) return { success: false, error: "Could not save birthday campaign settings." };
  revalidateMarketing();
  return { success: true };
}

// ============================================================================
// MARKETING DASHBOARD STATS
// ============================================================================
export async function getMarketingStats() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) {
    return { totalCampaigns: 0, totalSent: 0, activeCoupons: 0, pendingReferrals: 0, avgOpenRate: 0 };
  }

  const supabase = await createClient();
  const [{ count: totalCampaigns }, { data: campaigns }, { count: activeCoupons }, { count: pendingReferrals }] =
    await Promise.all([
      supabase.from("marketing_campaigns").select("*", { count: "exact", head: true }).eq("gym_id", actor.gym_id),
      supabase.from("campaign_analytics").select("recipients_sent, open_rate").eq("gym_id", actor.gym_id).eq("status", "sent"),
      supabase.from("coupons").select("*", { count: "exact", head: true }).eq("gym_id", actor.gym_id).eq("is_active", true),
      supabase.from("referrals").select("*", { count: "exact", head: true }).eq("gym_id", actor.gym_id).eq("status", "pending"),
    ]);

  const sentCampaigns = campaigns ?? [];
  const totalSent = sentCampaigns.reduce((sum, c) => sum + (c.recipients_sent ?? 0), 0);
  const avgOpenRate =
    sentCampaigns.length > 0
      ? Math.round((sentCampaigns.reduce((sum, c) => sum + Number(c.open_rate ?? 0), 0) / sentCampaigns.length) * 10) / 10
      : 0;

  return {
    totalCampaigns: totalCampaigns ?? 0,
    totalSent,
    activeCoupons: activeCoupons ?? 0,
    pendingReferrals: pendingReferrals ?? 0,
    avgOpenRate,
  };
}