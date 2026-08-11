import { z } from "zod";

export const subscriptionPlanFormSchema = z.object({
  code: z
    .string()
    .min(2, "Enter a plan code.")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only."),
  name: z.string().min(2, "Enter a plan name."),
  description: z.string().optional(),
  monthlyPrice: z.coerce.number().min(0, "Must be zero or greater."),
  annualPrice: z.coerce.number().min(0, "Must be zero or greater."),
  currency: z.string().min(1).default("INR"),
  maxGyms: z.coerce.number().int().positive().optional().nullable(),
  maxMembers: z.coerce.number().int().positive().optional().nullable(),
  maxStaff: z.coerce.number().int().positive().optional().nullable(),
  features: z.string().optional(), // newline-separated in the form, split into an array before saving
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
export type SubscriptionPlanFormInput = z.infer<typeof subscriptionPlanFormSchema>;

export const platformInvoiceFormSchema = z.object({
  tenantId: z.string().uuid("Select a tenant."),
  planCode: z.string().optional(),
  billingPeriodStart: z.string().min(1, "Select a start date."),
  billingPeriodEnd: z.string().min(1, "Select an end date."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  currency: z.string().min(1).default("INR"),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});
export type PlatformInvoiceFormInput = z.infer<typeof platformInvoiceFormSchema>;

export const tenantSuspendSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(3, "Give a reason — it's logged to the tenant's admin action history."),
});
export type TenantSuspendInput = z.infer<typeof tenantSuspendSchema>;

export const tenantPlanChangeSchema = z.object({
  tenantId: z.string().uuid(),
  planCode: z.string().min(1, "Select a plan."),
});
export type TenantPlanChangeInput = z.infer<typeof tenantPlanChangeSchema>;

export const featureFlagToggleSchema = z.object({
  tenantId: z.string().uuid(),
  flagKey: z.string().min(1),
  enabled: z.boolean(),
});
export type FeatureFlagToggleInput = z.infer<typeof featureFlagToggleSchema>;

export const platformSettingsFormSchema = z.object({
  platformName: z.string().min(1, "Enter a platform name."),
  supportEmail: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  defaultTrialDays: z.coerce.number().int().min(0),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().optional(),
  allowNewRegistrations: z.boolean(),
});
export type PlatformSettingsFormInput = z.infer<typeof platformSettingsFormSchema>;

export const ticketReplySchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1, "Write a message."),
  isInternalNote: z.boolean().default(false),
});
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;

export const ticketUpdateSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;
