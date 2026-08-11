import { z } from "zod";

export const staffFormSchema = z.object({
  fullName: z.string().min(2, "Enter a full name."),
  email: z.string().email("Enter a valid email."),
  phone: z.string().min(7, "Enter a valid phone number."),
  role: z.enum(["trainer", "receptionist"]),
  photoUrl: z.string().url().optional().nullable(),
});
export type StaffFormInput = z.infer<typeof staffFormSchema>;
