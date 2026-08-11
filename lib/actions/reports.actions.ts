"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission } from "@/lib/utils/permissions";
import type { ActionResult } from "./auth.actions";
import type {
  ExpenseCategory,
  Expense,
  RevenueReportRow,
  MembershipSummaryRow,
  AttendanceReportRow,
  TrainerPerformanceRow,
  InventoryReportRow,
  PaymentsByMethodRow,
  ProfitLossRow,
  GrowthAnalyticsRow,
  RenewalRateRow,
  RetentionRow,
} from "@/types/database";

// ============================================================================
// Shared date-range helper. Every report/analytics function takes an explicit
// [start, end] window so the UI's date-range picker drives everything — no
// report silently defaults to "all time" and surprises an owner with a slow
// query or a misleading number.
// ============================================================================
export interface DateRange {
  start: string; // ISO date, e.g. "2026-07-01"
  end: string;
}

function defaultThisMonth(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

async function gymScopedReport<T>(
  rpcName: string,
  range?: DateRange,
  extraArgs: Record<string, unknown> = {}
): Promise<ActionResult<T[]>> {
  try {
    await requirePermission("reports", "read");
  } catch {
    return { success: false, error: "You do not have permission to view reports." };
  }

  const profile = await getCurrentProfile();
  if (!profile?.gym_id) return { success: false, error: "No gym associated with this account." };

  const supabase = await createClient();
  const { start, end } = range ?? defaultThisMonth();
  const { data, error } = await supabase.rpc(rpcName, {
    p_gym_id: profile.gym_id,
    p_start: start,
    p_end: end,
    ...extraArgs,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as T[] };
}

// ============================================================================
// REVENUE
// ============================================================================
export async function getRevenueReport(range?: DateRange): Promise<ActionResult<RevenueReportRow[]>> {
  return gymScopedReport<RevenueReportRow>("report_revenue", range);
}

// ============================================================================
// MEMBERSHIP (no date range — it's a point-in-time active/expired snapshot)
// ============================================================================
export async function getMembershipSummary(): Promise<ActionResult<MembershipSummaryRow[]>> {
  try {
    await requirePermission("reports", "read");
  } catch {
    return { success: false, error: "You do not have permission to view reports." };
  }
  const profile = await getCurrentProfile();
  if (!profile?.gym_id) return { success: false, error: "No gym associated with this account." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_membership_summary", { p_gym_id: profile.gym_id });
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as MembershipSummaryRow[] };
}

// ============================================================================
// ATTENDANCE
// ============================================================================
export async function getAttendanceReport(range?: DateRange): Promise<ActionResult<AttendanceReportRow[]>> {
  return gymScopedReport<AttendanceReportRow>("report_attendance", range);
}

// ============================================================================
// TRAINER PERFORMANCE
// ============================================================================
export async function getTrainerPerformanceReport(range?: DateRange): Promise<ActionResult<TrainerPerformanceRow[]>> {
  return gymScopedReport<TrainerPerformanceRow>("report_trainer_performance", range);
}

// ============================================================================
// INVENTORY
// ============================================================================
export async function getInventoryReport(range?: DateRange): Promise<ActionResult<InventoryReportRow[]>> {
  return gymScopedReport<InventoryReportRow>("report_inventory", range);
}

// ============================================================================
// PAYMENTS BY METHOD
// ============================================================================
export async function getPaymentsByMethodReport(range?: DateRange): Promise<ActionResult<PaymentsByMethodRow[]>> {
  return gymScopedReport<PaymentsByMethodRow>("report_payments_by_method", range);
}

// ============================================================================
// PROFIT & LOSS
// ============================================================================
export async function getProfitLossReport(range?: DateRange): Promise<ActionResult<ProfitLossRow[]>> {
  return gymScopedReport<ProfitLossRow>("report_profit_loss", range);
}

// ============================================================================
// ANALYTICS
// ============================================================================
export async function getGrowthAnalytics(range?: DateRange): Promise<ActionResult<GrowthAnalyticsRow[]>> {
  return gymScopedReport<GrowthAnalyticsRow>("analytics_growth", range);
}

export async function getRenewalRateAnalytics(range?: DateRange): Promise<ActionResult<RenewalRateRow[]>> {
  return gymScopedReport<RenewalRateRow>("analytics_renewal_rate", range);
}

export async function getRetentionAnalytics(): Promise<ActionResult<RetentionRow[]>> {
  try {
    await requirePermission("reports", "read");
  } catch {
    return { success: false, error: "You do not have permission to view reports." };
  }
  const profile = await getCurrentProfile();
  if (!profile?.gym_id) return { success: false, error: "No gym associated with this account." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_retention", { p_gym_id: profile.gym_id });
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as RetentionRow[] };
}

// ============================================================================
// EXPENSES (CRUD — feeds the P&L report; gym-owner only, per permission matrix)
// ============================================================================
export interface CreateExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  vendor?: string;
  expenseDate: string;
  notes?: string;
}

export async function createExpense(input: CreateExpenseInput): Promise<ActionResult<{ expenseId: string }>> {
  try {
    await requirePermission("expenses", "create");
  } catch {
    return { success: false, error: "You do not have permission to record expenses." };
  }
  if (!input.description.trim()) return { success: false, error: "Description is required." };
  if (!(input.amount > 0)) return { success: false, error: "Amount must be greater than zero." };

  const profile = await getCurrentProfile();
  if (!profile?.gym_id) return { success: false, error: "No gym associated with this account." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      gym_id: profile.gym_id,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      vendor: input.vendor?.trim() || null,
      expense_date: input.expenseDate,
      notes: input.notes?.trim() || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/owner/reports");
  return { success: true, data: { expenseId: data.id } };
}

export async function updateExpense(
  expenseId: string,
  input: Partial<CreateExpenseInput>
): Promise<ActionResult> {
  try {
    await requirePermission("expenses", "update");
  } catch {
    return { success: false, error: "You do not have permission to edit expenses." };
  }
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.category) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.vendor !== undefined) patch.vendor = input.vendor?.trim() || null;
  if (input.expenseDate) patch.expense_date = input.expenseDate;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const { error } = await supabase.from("expenses").update(patch).eq("id", expenseId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/owner/reports");
  return { success: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  try {
    await requirePermission("expenses", "delete");
  } catch {
    return { success: false, error: "You do not have permission to delete expenses." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/owner/reports");
  return { success: true };
}

export interface ListExpensesParams {
  range?: DateRange;
  category?: ExpenseCategory;
}

export async function listExpenses(params: ListExpensesParams = {}): Promise<ActionResult<Expense[]>> {
  try {
    await requirePermission("reports", "read");
  } catch {
    return { success: false, error: "You do not have permission to view expenses." };
  }
  const profile = await getCurrentProfile();
  if (!profile?.gym_id) return { success: false, error: "No gym associated with this account." };

  const supabase = await createClient();
  const { start, end } = params.range ?? defaultThisMonth();
  let query = supabase
    .from("expenses")
    .select("*")
    .eq("gym_id", profile.gym_id)
    .gte("expense_date", start)
    .lte("expense_date", end)
    .order("expense_date", { ascending: false });

  if (params.category) query = query.eq("category", params.category);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as Expense[] };
}

// ============================================================================
// SUMMARY — combined KPI header for the Reports dashboard's top stat cards.
// Pulls the current-month P&L + revenue rows already computed above rather
// than recomputing anything, so the header always agrees with the tabs.
// ============================================================================
export interface ReportsSummary {
  monthRevenue: number;
  monthExpenses: number;
  monthProfit: number;
  activeMembers: number;
  monthCheckIns: number;
}

export async function getReportsSummary(): Promise<ActionResult<ReportsSummary>> {
  try {
    await requirePermission("reports", "read");
  } catch {
    return { success: false, error: "You do not have permission to view reports." };
  }
  const profile = await getCurrentProfile();
  if (!profile?.gym_id) return { success: false, error: "No gym associated with this account." };

  const supabase = await createClient();
  const range = defaultThisMonth();

  const [plRes, attRes, activeRes] = await Promise.all([
    supabase.rpc("report_profit_loss", { p_gym_id: profile.gym_id, p_start: range.start, p_end: range.end }),
    supabase.rpc("report_attendance", { p_gym_id: profile.gym_id, p_start: range.start, p_end: range.end }),
    supabase
      .from("member_details")
      .select("profile_id", { count: "exact", head: true })
      .eq("gym_id", profile.gym_id)
      .eq("status", "active"),
  ]);

  const pl = (plRes.data ?? []) as ProfitLossRow[];
  const att = (attRes.data ?? []) as AttendanceReportRow[];
  const latestMonth = pl[pl.length - 1];

  return {
    success: true,
    data: {
      monthRevenue: latestMonth?.revenue ?? 0,
      monthExpenses: latestMonth?.total_expenses ?? 0,
      monthProfit: latestMonth?.profit ?? 0,
      activeMembers: activeRes.count ?? 0,
      monthCheckIns: att.reduce((sum, row) => sum + row.check_ins, 0),
    },
  };
}
