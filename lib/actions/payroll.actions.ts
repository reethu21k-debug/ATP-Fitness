"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRole, PermissionError } from "@/lib/utils/permissions";
import type { ActionResult } from "./auth.actions";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// STAFF LIST + SALARY CONFIG
// ============================================================================
export async function getStaffList() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  const [{ data: staff }, { data: configs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, avatar_url").eq("gym_id", actor.gym_id).in("role", ["receptionist", "trainer", "gym_owner"]).eq("is_active", true),
    supabase.from("staff_salary_config").select("*").eq("gym_id", actor.gym_id),
  ]);

  return (staff ?? []).map((s) => ({ ...s, salaryConfig: configs?.find((c) => c.staff_id === s.id) ?? null }));
}

export async function upsertSalaryConfig(staffId: string, baseSalary: number, commissionRate: number): Promise<ActionResult> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not permitted." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_salary_config")
    .upsert({ staff_id: staffId, gym_id: actor.gym_id, base_salary: baseSalary, commission_rate: commissionRate }, { onConflict: "staff_id" });

  if (error) return { success: false, error: "Could not save salary details." };
  revalidatePath("/dashboard/owner/payroll");
  return { success: true };
}

// ============================================================================
// GENERATE PAYSLIP
// ============================================================================
export interface GeneratePayslipInput {
  staffId: string;
  month: string; // YYYY-MM-01
  bonus?: number;
  deductions?: number;
  presentDays?: number;
  totalWorkingDays?: number;
  notes?: string;
}

export async function generatePayslip(input: GeneratePayslipInput): Promise<ActionResult<{ payslipId: string }>> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not permitted." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { data: config } = await supabase.from("staff_salary_config").select("*").eq("staff_id", input.staffId).maybeSingle();
  const baseSalary = config?.base_salary ?? 0;
  const commissionRate = config?.commission_rate ?? 0;

  // Commission = % of payments this staff member processed during the month.
  const monthStart = input.month;
  const monthEnd = new Date(input.month);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("gym_id", actor.gym_id)
    .eq("created_by", input.staffId)
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd.toISOString().slice(0, 10));

  const processedTotal = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const commissionAmount = round2(processedTotal * (commissionRate / 100));

  // Pro-rate base salary by attendance if present/total days were provided.
  let proratedBase = baseSalary;
  if (input.presentDays != null && input.totalWorkingDays) {
    proratedBase = round2(baseSalary * (input.presentDays / input.totalWorkingDays));
  }

  const bonus = input.bonus ?? 0;
  const deductions = input.deductions ?? 0;
  const netPay = round2(proratedBase + commissionAmount + bonus - deductions);

  const { data: payslip, error } = await supabase
    .from("payslips")
    .upsert(
      {
        gym_id: actor.gym_id,
        staff_id: input.staffId,
        month: input.month,
        base_salary: proratedBase,
        commission_amount: commissionAmount,
        bonus_amount: bonus,
        deductions_amount: deductions,
        present_days: input.presentDays ?? null,
        total_working_days: input.totalWorkingDays ?? null,
        net_pay: netPay,
        status: "draft",
        notes: input.notes || null,
        generated_by: actor.id,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "gym_id,staff_id,month" }
    )
    .select()
    .single();

  if (error || !payslip) return { success: false, error: "Could not generate this payslip." };

  revalidatePath("/dashboard/owner/payroll");
  return { success: true, data: { payslipId: payslip.id } };
}

export async function markPayslipPaid(payslipId: string): Promise<ActionResult> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not permitted." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("payslips").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", payslipId);
  if (error) return { success: false, error: "Could not update this payslip." };
  revalidatePath("/dashboard/owner/payroll");
  return { success: true };
}

export async function listPayslips(month?: string) {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];

  const supabase = await createClient();
  let query = supabase
    .from("payslips")
    .select("*, profiles:staff_id(full_name, role, avatar_url)")
    .eq("gym_id", actor.gym_id)
    .order("month", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data } = await query;
  return data ?? [];
}

export async function getPayslipDetail(payslipId: string) {
  const actor = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: payslip }, { data: gym }] = await Promise.all([
    supabase.from("payslips").select("*, profiles:staff_id(full_name, role, email)").eq("id", payslipId).single(),
    supabase.from("gyms").select("name, address, city").eq("id", actor?.gym_id ?? "").single(),
  ]);

  return { payslip, gym };
}
