"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission, requireRole, PermissionError } from "@/lib/utils/permissions";
import type { ActionResult } from "./auth.actions";
import { createMember } from "./member.actions";
import type { MemberFormInput } from "@/lib/validations/member";
import type { LeadSource, LeadStatus, LeadActivityType } from "@/types/database";

// ============================================================================
// CREATE LEAD (walk-in, referral, online enquiry, etc.)
// ============================================================================
export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  interestedPlanId?: string;
  assignedTo?: string;
  followUpDate?: string;
  notes?: string;
}

export async function createLead(input: CreateLeadInput): Promise<ActionResult<{ leadId: string }>> {
  try {
    await requirePermission("leads", "create");
  } catch {
    return { success: false, error: "You do not have permission to add leads." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      gym_id: actor.gym_id,
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      source: input.source,
      interested_plan_id: input.interestedPlanId || null,
      assigned_to: input.assignedTo || actor.id,
      follow_up_date: input.followUpDate || null,
      notes: input.notes || null,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error || !lead) return { success: false, error: "Could not add this lead." };

  revalidatePath("/dashboard/reception/crm");
  revalidatePath("/dashboard/owner/crm");
  return { success: true, data: { leadId: lead.id } };
}

// ============================================================================
// UPDATE STATUS (pipeline stage move)
// ============================================================================
export async function updateLeadStatus(leadId: string, status: LeadStatus, extra?: { trialDate?: string; lostReason?: string }): Promise<ActionResult> {
  try {
    await requirePermission("leads", "update");
  } catch {
    return { success: false, error: "You do not have permission to update leads." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      status,
      ...(extra?.trialDate && { trial_date: extra.trialDate }),
      ...(extra?.lostReason && { lost_reason: extra.lostReason }),
    })
    .eq("id", leadId);

  if (error) return { success: false, error: "Could not update the lead's status." };

  revalidatePath("/dashboard/reception/crm");
  revalidatePath("/dashboard/owner/crm");
  return { success: true };
}

// ============================================================================
// LOG ACTIVITY (call, WhatsApp, email, note)
// ============================================================================
export async function logLeadActivity(leadId: string, activityType: LeadActivityType, description: string): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { error } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    gym_id: actor.gym_id,
    activity_type: activityType,
    description,
    created_by: actor.id,
  });
  if (error) return { success: false, error: "Could not log this activity." };

  revalidatePath("/dashboard/reception/crm");
  revalidatePath("/dashboard/owner/crm");
  return { success: true };
}

// ============================================================================
// UPDATE FOLLOW-UP DATE / ASSIGNMENT
// ============================================================================
export async function updateLeadFollowUp(leadId: string, followUpDate: string | null, assignedTo?: string): Promise<ActionResult> {
  try {
    await requirePermission("leads", "update");
  } catch {
    return { success: false, error: "You do not have permission to update leads." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ follow_up_date: followUpDate, ...(assignedTo && { assigned_to: assignedTo }) })
    .eq("id", leadId);
  if (error) return { success: false, error: "Could not update the follow-up date." };

  revalidatePath("/dashboard/reception/crm");
  revalidatePath("/dashboard/owner/crm");
  return { success: true };
}

// ============================================================================
// CONVERT LEAD → MEMBER (reuses the same automatic account creation flow)
// ============================================================================
export async function convertLeadToMember(leadId: string, memberInput: MemberFormInput): Promise<ActionResult<{ memberId: string }>> {
  const result = await createMember(memberInput);
  if (!result.success) return result;

  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ status: "converted", converted_member_id: result.data!.memberId })
    .eq("id", leadId);

  revalidatePath("/dashboard/reception/crm");
  revalidatePath("/dashboard/owner/crm");
  return result;
}

// ============================================================================
// DELETE LEAD (gym owner only, mirrors the member-deletion permission pattern)
// ============================================================================
export async function deleteLead(leadId: string): Promise<ActionResult> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not permitted." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { success: false, error: "Could not delete this lead." };
  revalidatePath("/dashboard/reception/crm");
  revalidatePath("/dashboard/owner/crm");
  return { success: true };
}

// ============================================================================
// LIST / FETCH
// ============================================================================
export async function listLeadsByStatus() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("leads_overview")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("created_at", { ascending: false });

  const grouped: Record<string, typeof data> = {};
  for (const lead of data ?? []) {
    grouped[lead.status] = grouped[lead.status] ?? [];
    grouped[lead.status]!.push(lead);
  }
  return grouped;
}

export async function getLeadDetail(leadId: string) {
  const supabase = await createClient();
  const [{ data: lead }, { data: activities }] = await Promise.all([
    supabase.from("leads_overview").select("*").eq("id", leadId).single(),
    supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
  ]);
  return { lead, activities: activities ?? [] };
}

export async function getDueFollowUpsToday() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("leads_overview")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .eq("follow_up_date", today)
    .not("status", "in", "(converted,lost)");

  return data ?? [];
}

export async function getCrmStats() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { totalLeads: 0, newThisWeek: 0, converted: 0, conversionRate: 0 };

  const supabase = await createClient();
  const { count: totalLeads } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("gym_id", actor.gym_id);
  const { count: converted } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("gym_id", actor.gym_id).eq("status", "converted");

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: newThisWeek } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("gym_id", actor.gym_id)
    .gte("created_at", weekAgo);

  const total = totalLeads ?? 0;
  const conv = converted ?? 0;
  return {
    totalLeads: total,
    newThisWeek: newThisWeek ?? 0,
    converted: conv,
    conversionRate: total > 0 ? Math.round((conv / total) * 100) : 0,
  };
}
