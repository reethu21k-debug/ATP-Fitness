"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentProfile, PermissionError } from "@/lib/utils/permissions";
import { membershipPlanFormSchema, type MembershipPlanFormInput } from "@/lib/validations/membership-plan";
import type { ActionResult } from "./auth.actions";

// RLS on membership_plans ("plans_write") already restricts inserts/updates/
// deletes to gym_owner for their own gym_id -- the requireRole check here
// exists just to fail fast with a clear message instead of a bare RLS error.

export interface MembershipPlanRow {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  description: string | null;
  is_active: boolean;
}

export async function listMembershipPlans(): Promise<MembershipPlanRow[]> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_plans")
    .select("id, name, duration_days, price, description, is_active")
    .eq("gym_id", actor.gym_id)
    .order("is_active", { ascending: false })
    .order("duration_days");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createMembershipPlan(input: MembershipPlanFormInput): Promise<ActionResult<{ planId: string }>> {
  const parsed = membershipPlanFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid plan details." };
  }

  try {
    await requireRole("gym_owner");
  } catch (err) {
    if (err instanceof PermissionError) return { success: false, error: err.message };
    throw err;
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "No gym found for your account." };

  const supabase = await createClient();
  const { name, durationDays, price, description } = parsed.data;

  const { data, error } = await supabase
    .from("membership_plans")
    .insert({
      gym_id: actor.gym_id,
      name,
      duration_days: durationDays,
      price,
      description: description ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: "Could not create the plan." };

  revalidatePath("/dashboard/owner/plans");
  return { success: true, data: { planId: data.id } };
}

export async function updateMembershipPlan(
  planId: string,
  input: MembershipPlanFormInput
): Promise<ActionResult> {
  const parsed = membershipPlanFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid plan details." };
  }

  try {
    await requireRole("gym_owner");
  } catch (err) {
    if (err instanceof PermissionError) return { success: false, error: err.message };
    throw err;
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "No gym found for your account." };

  const supabase = await createClient();
  const { name, durationDays, price, description } = parsed.data;

  // Note: this only changes the plan's own row -- existing members already on
  // this plan keep their locked-in amount/end_date in member_memberships (a
  // snapshot taken at signup time), so editing a plan's price never
  // retroactively changes what a current member owes or when they expire.
  // It only affects new signups/renewals made against this plan going forward.
  const { data, error } = await supabase
    .from("membership_plans")
    .update({ name, duration_days: durationDays, price, description: description ?? null })
    .eq("id", planId)
    .eq("gym_id", actor.gym_id)
    .select("id");

  if (error) return { success: false, error: "Could not update the plan." };
  if (!data || data.length === 0) return { success: false, error: "Plan not found." };

  revalidatePath("/dashboard/owner/plans");
  return { success: true };
}

export async function setMembershipPlanActive(planId: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requireRole("gym_owner");
  } catch (err) {
    if (err instanceof PermissionError) return { success: false, error: err.message };
    throw err;
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "No gym found for your account." };

  const supabase = await createClient();
  // Deactivating (not deleting) keeps the plan intact for members already on
  // it and for historical payment/invoice records, while hiding it from the
  // "Add member" plan picker for new signups.
  const { data, error } = await supabase
    .from("membership_plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .eq("gym_id", actor.gym_id)
    .select("id");

  if (error) return { success: false, error: "Could not update the plan." };
  if (!data || data.length === 0) return { success: false, error: "Plan not found." };

  revalidatePath("/dashboard/owner/plans");
  return { success: true };
}