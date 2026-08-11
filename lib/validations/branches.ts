import { z } from "zod";

export const branchFormSchema = z.object({
  name: z.string().min(2, "Enter a branch name."),
  code: z
    .string()
    .min(2, "Enter a short branch code (e.g. MAIN, NORTH).")
    .regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, dashes, underscores only."),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("India"),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  timezone: z.string().default("Asia/Kolkata"),
  gpsCheckinRadiusMeters: z.coerce.number().int().positive().default(200),
  managerId: z.string().uuid().optional().or(z.literal("")),
  monthlyRevenueTarget: z.coerce.number().min(0).optional().nullable(),
});
export type BranchFormInput = z.infer<typeof branchFormSchema>;
