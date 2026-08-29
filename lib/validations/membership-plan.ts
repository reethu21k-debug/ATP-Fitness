import { z } from "zod";

export const membershipPlanFormSchema = z.object({
  name: z.string().min(2, "Enter a plan name."),
  durationDays: z.coerce.number().int().positive("Duration must be a positive number of days."),
  price: z.coerce.number().nonnegative("Price can't be negative."),
  description: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
});

export type MembershipPlanFormInput = z.infer<typeof membershipPlanFormSchema>;