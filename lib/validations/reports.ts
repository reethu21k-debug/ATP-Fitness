import { z } from "zod";

export const expenseFormSchema = z.object({
  category: z.enum(["rent", "utilities", "salaries", "equipment", "marketing", "maintenance", "other"]),
  description: z.string().min(2, "Enter a short description."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  vendor: z.string().optional(),
  expenseDate: z.string().min(1, "Select a date."),
  notes: z.string().optional(),
});

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;

export const dateRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
