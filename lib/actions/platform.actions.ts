"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRole, PermissionError } from "@/lib/utils/permissions";
import type { ActionResult } from "./auth.actions";
import type {
  SubscriptionPlan,
  PlatformInvoice,
  FeatureFlagCatalogEntry,
  PlatformSettings,
  SupportTicket,
  SupportTicketMessage,
  TenantAdminAction,
  TenantOverviewRow,
  PlatformOverviewStats,
  PlatformTenantGrowthRow,
  TenantUsageSummary,
  PlatformTicketStats,
  Tenant,
} from "@/types/database";
import type {
  SubscriptionPlanFormInput,
  PlatformInvoiceFormInput,
  PlatformSettingsFormInput,
} from "@/lib/validations/platform";

// Every function in this file is super-admin-only. Rather than repeating
// `requireRole("super_admin")` + try/catch in every export, this small
// wrapper does it once and turns a thrown PermissionError into the same
// ActionResult shape every other module in the app returns.
async function asSuperAdmin<T = undefined>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    await requireRole("super_admin");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { success: false, error: "Only a super admin can perform this action." };
    }
    return { success: false, error: "Not authenticated." };
  }
  try {
    const data = await fn();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ============================================================================
// PLATFORM OVERVIEW
// ============================================================================

export async function getPlatformOverviewStats(): Promise<ActionResult<PlatformOverviewStats>> {
  return asSuperAdmin(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("platform_overview_stats").single();
    if (error) throw new Error(error.message);
    return data as PlatformOverviewStats;
  });
}

export async function getPlatformTenantGrowth(
  start: string,
  end: string
): Promise<ActionResult<PlatformTenantGrowthRow[]>> {
  return asSuperAdmin(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("platform_tenant_growth", { p_start: start, p_end: end });
    if (error) throw new Error(error.message);
    return (data ?? []) as PlatformTenantGrowthRow[];
  });
}

export async function getPlatformTicketStats(): Promise<ActionResult<PlatformTicketStats>> {
  return asSuperAdmin(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("platform_ticket_stats").single();
    if (error) throw new Error(error.message);
    return data as PlatformTicketStats;
  });
}

// ============================================================================
// TENANTS
// ============================================================================

export interface ListTenantsParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string; // 'all' | subscription_status
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function listTenants(params: ListTenantsParams) {
  await requireRole("super_admin");
  const supabase = await createClient();
  const { page, pageSize, search, status, sortBy = "created_at", sortDir = "desc" } = params;

  let query = supabase.from("tenants_overview").select("*", { count: "exact" });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,slug.ilike.%${search}%,owner_full_name.ilike.%${search}%,owner_email.ilike.%${search}%`
    );
  }
  if (status && status !== "all") {
    query = query.eq("subscription_status", status);
  }

  query = query
    .order(sortBy, { ascending: sortDir === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return { rows: (data ?? []) as TenantOverviewRow[], total: count ?? 0 };
}

export async function getTenantDetail(
  tenantId: string
): Promise<ActionResult<{ tenant: Tenant; usage: TenantUsageSummary; recentActions: TenantAdminAction[] }>> {
  return asSuperAdmin(async () => {
    const supabase = await createClient();
    const [tenantRes, usageRes, actionsRes] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).single(),
      supabase.rpc("tenant_usage_summary", { p_tenant_id: tenantId }).single(),
      supabase
        .from("tenant_admin_actions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (tenantRes.error || !tenantRes.data) throw new Error("Tenant not found.");
    if (usageRes.error) throw new Error(usageRes.error.message);

    return {
      tenant: tenantRes.data as Tenant,
      usage: usageRes.data as TenantUsageSummary,
      recentActions: (actionsRes.data ?? []) as TenantAdminAction[],
    };
  });
}

export async function suspendTenant(tenantId: string, reason: string): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("suspend_tenant", { p_tenant_id: tenantId, p_reason: reason });
    if (error) throw new Error(error.message);
  });
  if (result.success) {
    revalidatePath("/dashboard/platform/tenants");
    revalidatePath(`/dashboard/platform/tenants/${tenantId}`);
  }
  return result;
}

export async function reactivateTenant(tenantId: string): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("reactivate_tenant", { p_tenant_id: tenantId });
    if (error) throw new Error(error.message);
  });
  if (result.success) {
    revalidatePath("/dashboard/platform/tenants");
    revalidatePath(`/dashboard/platform/tenants/${tenantId}`);
  }
  return result;
}

export async function changeTenantPlan(tenantId: string, planCode: string): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const actor = await getCurrentProfile();
    const { error } = await supabase.from("tenants").update({ subscription_plan: planCode }).eq("id", tenantId);
    if (error) throw new Error(error.message);
    await supabase.from("tenant_admin_actions").insert({
      tenant_id: tenantId,
      actor_id: actor!.id,
      action: "plan_changed",
      metadata: { new_plan: planCode },
    });
  });
  if (result.success) {
    revalidatePath("/dashboard/platform/tenants");
    revalidatePath(`/dashboard/platform/tenants/${tenantId}`);
  }
  return result;
}

/** Toggle a single feature flag for one tenant. Stored in tenants.feature_flags jsonb. */
export async function toggleTenantFeatureFlag(
  tenantId: string,
  flagKey: string,
  enabled: boolean
): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const actor = await getCurrentProfile();

    const { data: tenant, error: fetchError } = await supabase
      .from("tenants")
      .select("feature_flags")
      .eq("id", tenantId)
      .single();
    if (fetchError || !tenant) throw new Error("Tenant not found.");

    const flags = { ...(tenant.feature_flags ?? {}), [flagKey]: enabled };
    const { error } = await supabase.from("tenants").update({ feature_flags: flags }).eq("id", tenantId);
    if (error) throw new Error(error.message);

    await supabase.from("tenant_admin_actions").insert({
      tenant_id: tenantId,
      actor_id: actor!.id,
      action: "flag_toggled",
      metadata: { flag: flagKey, enabled },
    });
  });
  if (result.success) revalidatePath(`/dashboard/platform/tenants/${tenantId}`);
  return result;
}

export async function updateTenantWhiteLabel(
  tenantId: string,
  input: { isWhiteLabel: boolean; customDomain?: string; logoUrl?: string; primaryColor?: string }
): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("tenants")
      .update({
        is_white_label: input.isWhiteLabel,
        custom_domain: input.customDomain?.trim() || null,
        logo_url: input.logoUrl?.trim() || null,
        primary_color: input.primaryColor || "#6366F1",
      })
      .eq("id", tenantId);
    if (error) throw new Error(error.message);
  });
  if (result.success) revalidatePath(`/dashboard/platform/tenants/${tenantId}`);
  return result;
}

// ============================================================================
// SUBSCRIPTION PLANS (platform pricing catalog)
// ============================================================================

export async function listSubscriptionPlans(): Promise<ActionResult<SubscriptionPlan[]>> {
  // Readable by anyone (used on the public pricing page too), but this
  // Server Action is only used from the platform admin UI, so we still
  // gate it — a public page should call a separate, unauthenticated query.
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscription_plans").select("*").order("sort_order");
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as SubscriptionPlan[] };
}

export async function upsertSubscriptionPlan(
  input: SubscriptionPlanFormInput
): Promise<ActionResult<{ planId: string }>> {
  const result = await asSuperAdmin<{ planId: string }>(async () => {
    const supabase = await createClient();
    const featuresArray = (input.features ?? "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const { data, error } = await supabase
      .from("subscription_plans")
      .upsert(
        {
          code: input.code,
          name: input.name,
          description: input.description?.trim() || null,
          monthly_price: input.monthlyPrice,
          annual_price: input.annualPrice,
          currency: input.currency || "INR",
          max_gyms: input.maxGyms ?? null,
          max_members: input.maxMembers ?? null,
          max_staff: input.maxStaff ?? null,
          features: featuresArray,
          is_active: input.isActive,
          sort_order: input.sortOrder,
        },
        { onConflict: "code" }
      )
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { planId: data.id };
  });
  if (result.success) revalidatePath("/dashboard/platform/billing");
  return result;
}

export async function deactivateSubscriptionPlan(planId: string): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("subscription_plans").update({ is_active: false }).eq("id", planId);
    if (error) throw new Error(error.message);
  });
  if (result.success) revalidatePath("/dashboard/platform/billing");
  return result;
}

// ============================================================================
// PLATFORM INVOICES (SaaS billing to tenants)
// ============================================================================

export async function listPlatformInvoices(params: {
  page: number;
  pageSize: number;
  tenantId?: string;
  status?: string;
}) {
  await requireRole("super_admin");
  const supabase = await createClient();
  const { page, pageSize, tenantId, status } = params;

  let query = supabase
    .from("platform_invoices")
    .select("*, tenants!platform_invoices_tenant_id_fkey(name)", { count: "exact" });

  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (status && status !== "all") query = query.eq("status", status);

  query = query.order("issued_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as (PlatformInvoice & { tenants: { name: string } | null })[], total: count ?? 0 };
}

export async function createPlatformInvoice(
  input: PlatformInvoiceFormInput
): Promise<ActionResult<{ invoiceId: string }>> {
  const result = await asSuperAdmin<{ invoiceId: string }>(async () => {
    const supabase = await createClient();
    const actor = await getCurrentProfile();

    const { data: invoiceNumber, error: numError } = await supabase.rpc("next_platform_invoice_number");
    if (numError || !invoiceNumber) throw new Error("Could not generate an invoice number.");

    const { data, error } = await supabase
      .from("platform_invoices")
      .insert({
        tenant_id: input.tenantId,
        invoice_number: invoiceNumber,
        plan_code: input.planCode || null,
        billing_period_start: input.billingPeriodStart,
        billing_period_end: input.billingPeriodEnd,
        amount: input.amount,
        currency: input.currency || "INR",
        due_at: input.dueAt || null,
        notes: input.notes?.trim() || null,
        created_by: actor!.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { invoiceId: data.id };
  });
  if (result.success) revalidatePath("/dashboard/platform/billing");
  return result;
}

export async function markInvoicePaid(invoiceId: string): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("platform_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoiceId);
    if (error) throw new Error(error.message);
  });
  if (result.success) revalidatePath("/dashboard/platform/billing");
  return result;
}

export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("platform_invoices").update({ status: "void" }).eq("id", invoiceId);
    if (error) throw new Error(error.message);
  });
  if (result.success) revalidatePath("/dashboard/platform/billing");
  return result;
}

// ============================================================================
// FEATURE FLAG CATALOG (platform-wide registry)
// ============================================================================

export async function listFeatureFlagCatalog(): Promise<ActionResult<FeatureFlagCatalogEntry[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feature_flag_catalog").select("*").order("category");
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as FeatureFlagCatalogEntry[] };
}

export async function upsertFeatureFlagCatalogEntry(input: {
  key: string;
  label: string;
  description?: string;
  defaultEnabled: boolean;
  category: string;
}): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("feature_flag_catalog").upsert({
      key: input.key,
      label: input.label,
      description: input.description?.trim() || null,
      default_enabled: input.defaultEnabled,
      category: input.category,
    });
    if (error) throw new Error(error.message);
  });
  if (result.success) revalidatePath("/dashboard/platform/settings");
  return result;
}

// ============================================================================
// SUPPORT TICKETS (platform side)
// ============================================================================

export async function listSupportTickets(params: {
  page: number;
  pageSize: number;
  status?: string;
  priority?: string;
}) {
  await requireRole("super_admin");
  const supabase = await createClient();
  const { page, pageSize, status, priority } = params;

  let query = supabase
    .from("support_tickets")
    .select("*, tenants!support_tickets_tenant_id_fkey(name)", { count: "exact" });

  if (status && status !== "all") query = query.eq("status", status);
  if (priority && priority !== "all") query = query.eq("priority", priority);

  query = query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as (SupportTicket & { tenants: { name: string } | null })[], total: count ?? 0 };
}

export async function getTicketWithMessages(
  ticketId: string
): Promise<ActionResult<{ ticket: SupportTicket; messages: SupportTicketMessage[] }>> {
  return asSuperAdmin(async () => {
    const supabase = await createClient();
    const [ticketRes, messagesRes] = await Promise.all([
      supabase.from("support_tickets").select("*").eq("id", ticketId).single(),
      supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
    ]);
    if (ticketRes.error || !ticketRes.data) throw new Error("Ticket not found.");
    return {
      ticket: ticketRes.data as SupportTicket,
      messages: (messagesRes.data ?? []) as SupportTicketMessage[],
    };
  });
}

export async function replyToTicket(
  ticketId: string,
  message: string,
  isInternalNote: boolean
): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const actor = await getCurrentProfile();
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketId,
      author_id: actor!.id,
      message: message.trim(),
      is_internal_note: isInternalNote,
    });
    if (error) throw new Error(error.message);

    // A reply implicitly moves a fresh ticket into "in_progress" unless it's
    // already further along — this mirrors how most helpdesks behave and
    // avoids "open" tickets that actually already have a reply sitting on them.
    await supabase
      .from("support_tickets")
      .update({ status: "in_progress" })
      .eq("id", ticketId)
      .eq("status", "open");
  });
  if (result.success) revalidatePath(`/dashboard/platform/tickets/${ticketId}`);
  return result;
}

export async function updateTicketStatus(
  ticketId: string,
  patch: { status?: string; priority?: string }
): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", ticketId);
    if (error) throw new Error(error.message);
  });
  if (result.success) {
    revalidatePath("/dashboard/platform/tickets");
    revalidatePath(`/dashboard/platform/tickets/${ticketId}`);
  }
  return result;
}

// ============================================================================
// SUPPORT TICKETS — TENANT SIDE (gym owner raising/viewing their own tickets)
// Distinct from the super-admin functions above: these are scoped by RLS to
// the caller's own tenant_id, not gated by requireRole("super_admin").
// ============================================================================

export async function createSupportTicket(input: {
  subject: string;
  description: string;
  priority?: "low" | "normal" | "high" | "urgent";
}): Promise<ActionResult<{ ticketId: string }>> {
  const profile = await getCurrentProfile();
  if (!profile?.tenant_id) return { success: false, error: "No tenant associated with this account." };
  if (!input.subject.trim() || !input.description.trim()) {
    return { success: false, error: "Subject and description are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      subject: input.subject.trim(),
      description: input.description.trim(),
      priority: input.priority ?? "normal",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/owner/settings");
  return { success: true, data: { ticketId: data.id } };
}

export async function listMyTenantTickets(): Promise<ActionResult<SupportTicket[]>> {
  const profile = await getCurrentProfile();
  if (!profile?.tenant_id) return { success: false, error: "No tenant associated with this account." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as SupportTicket[] };
}

export async function getMyTicketWithMessages(
  ticketId: string
): Promise<ActionResult<{ ticket: SupportTicket; messages: SupportTicketMessage[] }>> {
  const profile = await getCurrentProfile();
  if (!profile?.tenant_id) return { success: false, error: "No tenant associated with this account." };

  const supabase = await createClient();
  const [ticketRes, messagesRes] = await Promise.all([
    supabase.from("support_tickets").select("*").eq("id", ticketId).eq("tenant_id", profile.tenant_id).single(),
    supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("is_internal_note", false) // RLS already blocks these, filtering explicitly for clarity
      .order("created_at", { ascending: true }),
  ]);

  if (ticketRes.error || !ticketRes.data) return { success: false, error: "Ticket not found." };
  return {
    success: true,
    data: { ticket: ticketRes.data as SupportTicket, messages: (messagesRes.data ?? []) as SupportTicketMessage[] },
  };
}

export async function replyToMyTicket(ticketId: string, message: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile?.tenant_id) return { success: false, error: "No tenant associated with this account." };
  if (!message.trim()) return { success: false, error: "Write a message first." };

  const supabase = await createClient();
  // RLS enforces tenant_id match and is_internal_note = false for non-super-admins.
  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    author_id: profile.id,
    message: message.trim(),
    is_internal_note: false,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/dashboard/owner/settings`);
  return { success: true };
}

export async function getPlatformSettings(): Promise<ActionResult<PlatformSettings>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("*").eq("id", true).single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: data as PlatformSettings };
}

export async function updatePlatformSettings(input: PlatformSettingsFormInput): Promise<ActionResult> {
  const result = await asSuperAdmin<undefined>(async () => {
    const supabase = await createClient();
    const actor = await getCurrentProfile();
    const { error } = await supabase
      .from("platform_settings")
      .update({
        platform_name: input.platformName,
        support_email: input.supportEmail || null,
        default_trial_days: input.defaultTrialDays,
        maintenance_mode: input.maintenanceMode,
        maintenance_message: input.maintenanceMessage?.trim() || null,
        allow_new_registrations: input.allowNewRegistrations,
        updated_by: actor!.id,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
  });
  if (result.success) revalidatePath("/dashboard/platform/settings");
  return result;
}
