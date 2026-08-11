"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission, requireRole, PermissionError } from "@/lib/utils/permissions";
import type { ActionResult } from "./auth.actions";
import type { Gym, BranchComparisonRow, TenantCombinedOverview } from "@/types/database";
import { branchFormSchema, type BranchFormInput } from "@/lib/validations/branches";

// ============================================================================
// LIST BRANCHES (all gyms under the caller's tenant)
// ============================================================================
export async function listBranches(): Promise<ActionResult<{ branches: Gym[]; activeGymId: string | null }>> {
  const actor = await getCurrentProfile();
  if (!actor?.tenant_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .select("*")
    .eq("tenant_id", actor.tenant_id)
    .order("created_at", { ascending: true });

  if (error) return { success: false, error: "Could not load branches." };
  return { success: true, data: { branches: (data ?? []) as Gym[], activeGymId: actor.gym_id } };
}

// ============================================================================
// CREATE BRANCH
// ============================================================================
export async function createBranch(input: BranchFormInput): Promise<ActionResult<{ gymId: string }>> {
  const parsed = branchFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { success: false, error: "Please check the form for errors.", fieldErrors };
  }

  try {
    await requirePermission("branches", "create");
  } catch {
    return { success: false, error: "You do not have permission to add branches." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.tenant_id) return { success: false, error: "Your account isn't linked to a gym." };

  const data = parsed.data;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("gyms")
    .insert({
      tenant_id: actor.tenant_id,
      name: data.name,
      code: data.code,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || "India",
      postal_code: data.postalCode || null,
      phone: data.phone || null,
      email: data.email || null,
      timezone: data.timezone || "Asia/Kolkata",
      gps_checkin_radius_meters: data.gpsCheckinRadiusMeters ?? 200,
      manager_id: data.managerId || null,
      monthly_revenue_target: data.monthlyRevenueTarget ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "A branch with that code already exists." };
    return { success: false, error: "Could not create the branch." };
  }

  revalidatePath("/dashboard/owner/branches");
  return { success: true, data: { gymId: created.id } };
}

// ============================================================================
// UPDATE BRANCH
// ============================================================================
export async function updateBranch(gymId: string, input: BranchFormInput): Promise<ActionResult> {
  const parsed = branchFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { success: false, error: "Please check the form for errors.", fieldErrors };
  }

  try {
    await requirePermission("branches", "update");
  } catch {
    return { success: false, error: "You do not have permission to edit branches." };
  }

  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({
      name: data.name,
      code: data.code,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || "India",
      postal_code: data.postalCode || null,
      phone: data.phone || null,
      email: data.email || null,
      timezone: data.timezone || "Asia/Kolkata",
      gps_checkin_radius_meters: data.gpsCheckinRadiusMeters ?? 200,
      manager_id: data.managerId || null,
      monthly_revenue_target: data.monthlyRevenueTarget ?? null,
    })
    .eq("id", gymId);

  if (error) {
    if (error.code === "23505") return { success: false, error: "A branch with that code already exists." };
    return { success: false, error: "Could not update the branch." };
  }

  revalidatePath("/dashboard/owner/branches");
  return { success: true };
}

// ============================================================================
// TOGGLE BRANCH ACTIVE / INACTIVE (soft — never deletes real operational data)
// ============================================================================
export async function setBranchActive(gymId: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requirePermission("branches", "update");
  } catch {
    return { success: false, error: "You do not have permission to edit branches." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ is_active: isActive }).eq("id", gymId);
  if (error) return { success: false, error: "Could not update the branch." };

  revalidatePath("/dashboard/owner/branches");
  return { success: true };
}

// ============================================================================
// SWITCH ACTIVE BRANCH
// The gym_owner's own profile.gym_id determines which branch every other
// module in the app (members, payments, attendance, inventory, payroll,
// marketing, reports…) reads and writes. Switching branches here is what
// makes all of that branch-aware, with no changes needed to those modules.
// ============================================================================
export async function switchActiveBranch(gymId: string): Promise<ActionResult> {
  try {
    await requireRole("gym_owner");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not authenticated." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_active_branch", { p_gym_id: gymId });
  if (error) return { success: false, error: error.message || "Could not switch branches." };

  revalidatePath("/", "layout");
  return { success: true };
}

// ============================================================================
// COMBINED ANALYTICS ACROSS BRANCHES
// ============================================================================
export async function getBranchComparison(start: string, end: string): Promise<ActionResult<BranchComparisonRow[]>> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not authenticated." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tenant_branch_comparison", { p_start: start, p_end: end });
  if (error) return { success: false, error: "Could not load branch comparison." };
  return { success: true, data: (data ?? []) as BranchComparisonRow[] };
}

export async function getTenantCombinedOverview(): Promise<ActionResult<TenantCombinedOverview>> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not authenticated." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tenant_combined_overview").single();
  if (error) return { success: false, error: "Could not load combined overview." };
  return { success: true, data: data as TenantCombinedOverview };
}

// ============================================================================
// LIST TENANT STAFF (for the branch-manager picker in the branch form)
// ============================================================================
export async function listTenantStaffForPicker(): Promise<{ id: string; full_name: string; role: string }[]> {
  const actor = await getCurrentProfile();
  if (!actor?.tenant_id) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("tenant_id", actor.tenant_id)
    .in("role", ["trainer", "receptionist", "gym_owner"])
    .order("full_name");

  return data ?? [];
}
