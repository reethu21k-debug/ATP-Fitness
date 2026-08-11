import { z } from "zod";

export const memberFormSchema = z.object({
  fullName: z.string().min(2, "Enter the member's full name."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter phone in international format, e.g. +919876543210."),
  photoUrl: z.string().url().nullable().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]).default("unknown"),
  medicalConditions: z.string().optional(),
  heightCm: z.coerce.number().positive().optional(),
  weightKg: z.coerce.number().positive().optional(),
  joiningDate: z.string().min(1, "Select a joining date."),

  // Membership
  planId: z.string().uuid("Select a membership plan."),
  startDate: z.string().min(1, "Select a start date."),
  amount: z.coerce.number().nonnegative(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  amountPaid: z.coerce.number().nonnegative().default(0),
  paymentStatus: z.enum(["paid", "partial", "pending"]).default("pending"),
  trainerId: z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.string().uuid("Select a valid trainer.").nullable().optional()
  ),
});

export type MemberFormInput = z.infer<typeof memberFormSchema>;