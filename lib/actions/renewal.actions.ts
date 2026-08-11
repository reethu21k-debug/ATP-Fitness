"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission, PermissionError } from "@/lib/utils/permissions";
import { sendEmail, renewalReminderEmailHtml, renewalReminderEmailText, renewalReminderEmailSubject } from "@/lib/services/email";
import type { ActionResult } from "./auth.actions";

/**
 * Lets a gym owner/receptionist send a renewal reminder to a member by
 * hand, on demand -- unlike the automated cron windows (7d/3d/1d before,
 * on expiry), this is NOT logged to renewal_reminder_log and has no
 * de-dupe check, so it can be clicked as many times as needed, at any
 * time, including long after the membership has already expired.
 */
export async function sendManualRenewalReminder(membershipId: string): Promise<ActionResult> {
  try {
    await requirePermission("members", "update");
  } catch (err) {
    if (err instanceof PermissionError) return { success: false, error: err.message };
    throw err;
  }

  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from("member_memberships")
    .select("id, end_date, profiles:member_id(full_name, email), gyms:gym_id(name), membership_plans:plan_id(name)")
    .eq("id", membershipId)
    .single();

  if (error || !membership) {
    return { success: false, error: "Could not find that membership." };
  }

  const member = membership.profiles as unknown as { full_name: string; email: string | null } | null;
  const gym = membership.gyms as unknown as { name: string } | null;
  const plan = membership.membership_plans as unknown as { name: string } | null;

  if (!member?.email) {
    return { success: false, error: "This member has no email on file." };
  }

  const gymName = gym?.name ?? "your gym";
  const daysUntilExpiry = Math.round(
    (new Date(membership.end_date).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const emailResult = await sendEmail({
    to: member.email,
    subject: renewalReminderEmailSubject({ gymName, kind: "manual", daysUntilExpiry }),
    html: renewalReminderEmailHtml({
      memberName: member.full_name,
      gymName,
      planName: plan?.name ?? "Membership",
      endDate: membership.end_date,
      kind: "manual",
      daysUntilExpiry,
      membershipUrl: `${appUrl}/dashboard/member/membership`,
    }),
    text: renewalReminderEmailText({
      memberName: member.full_name,
      gymName,
      planName: plan?.name ?? "Membership",
      endDate: membership.end_date,
      kind: "manual",
      daysUntilExpiry,
      membershipUrl: `${appUrl}/dashboard/member/membership`,
    }),
  });

  if (!emailResult.success) {
    return { success: false, error: "Could not send the reminder email. Check email configuration." };
  }

  return { success: true };
}