"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  name: z.string().min(2, "Enter your name."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().min(7, "Enter a valid phone number so we can call you back."),
  message: z.string().min(10, "Tell us a bit more (10+ characters)."),
});

export type ContactInput = z.infer<typeof contactSchema>;

export async function submitContactForm(
  input: ContactInput
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();

  // Single-branch deployment: find ATP Fitness's own branch record.
  // (If ATP Fitness opens a second branch later, filter this by a specific
  // branch code/slug instead of just taking the first one.)
  const { data: gym, error: gymError } = await admin
    .from("gyms")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (gymError || !gym) {
    return { success: false, error: "Could not send your message. Please try again or call us directly." };
  }

  const { error } = await admin.from("leads").insert({
    gym_id: gym.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email,
    source: "online",
    notes: parsed.data.message,
  });

  if (error) return { success: false, error: "Could not send your message. Please try again." };

  revalidatePath("/dashboard/reception/crm");
  revalidatePath("/dashboard/owner/crm");
  return { success: true };
}