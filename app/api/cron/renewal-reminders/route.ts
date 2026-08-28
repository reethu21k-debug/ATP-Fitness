import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  sendEmail,
  renewalReminderEmailHtml,
  renewalReminderEmailText,
  renewalReminderEmailSubject,
  type RenewalReminderKind,
} from "@/lib/services/email";
import { sendSubscriptionExpiredWhatsApp } from "@/lib/services/whatsapp-cloud";
import type { ReminderType } from "@/types/database";

// Node runtime -- nodemailer (the Gmail SMTP transport used everywhere else
// in this app, e.g. password resets) doesn't run on the Edge runtime.
export const runtime = "nodejs";

/**
 * GET /api/cron/renewal-reminders
 *
 * Runs once a day (see supabase/migrations for the pg_cron job that calls
 * this with the x-cron-secret header). For every currently-active
 * membership whose end_date lands exactly 7, 3, or 1 day(s) from now, or
 * is today, sends one reminder email via the same Gmail SMTP transport
 * used for password resets -- not the Resend-based renewal-reminders Edge
 * Function, which is a separate WhatsApp+Resend pipeline.
 *
 * Each membership + window is only ever sent once, tracked in
 * renewal_reminder_log (same table/shape the Edge Function already uses),
 * so re-running this on the same day is safe.
 */

type Window = { type: Extract<ReminderType, "before_7d" | "before_3d" | "before_1d" | "on_expiry">; offsetDays: number; kind: RenewalReminderKind };

const WINDOWS: Window[] = [
  { type: "before_7d", offsetDays: 7, kind: "before_7d" },
  { type: "before_3d", offsetDays: 3, kind: "before_3d" },
  { type: "before_1d", offsetDays: 1, kind: "before_1d" },
  { type: "on_expiry", offsetDays: 0, kind: "on_expiry" },
];

function dateOffset(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const results: Record<string, number> = {};

  for (const window of WINDOWS) {
    const targetDate = dateOffset(window.offsetDays);

    const { data: memberships, error } = await admin
      .from("member_memberships")
      .select(
        "id, end_date, profiles:member_id(full_name, email, phone), gyms:gym_id(name), membership_plans:plan_id(name)"
      )
      .eq("is_current", true)
      .eq("end_date", targetDate);

    if (error) {
      console.error(`renewal-reminders: query failed for ${window.type}:`, error.message);
      continue;
    }

    let sentCount = 0;
    for (const m of memberships ?? []) {
      // De-dupe: never send the same window twice for the same membership.
      const { data: existing } = await admin
        .from("renewal_reminder_log")
        .select("id")
        .eq("membership_id", m.id)
        .eq("reminder_type", window.type)
        .maybeSingle();
      if (existing) continue;

      const member = m.profiles as unknown as { full_name: string; email: string | null; phone: string | null } | null;
      const gym = m.gyms as unknown as { name: string } | null;
      const plan = m.membership_plans as unknown as { name: string } | null;
      if (!member || (!member.email && !member.phone)) continue;

      const gymName = gym?.name ?? "your gym";
      const planName = plan?.name ?? "Membership";
      const daysUntilExpiry = window.kind === "on_expiry" ? 0 : window.offsetDays;

      let sentAny = false;

      if (member.email) {
        const emailResult = await sendEmail({
          to: member.email,
          subject: renewalReminderEmailSubject({ gymName, kind: window.kind, daysUntilExpiry }),
          html: renewalReminderEmailHtml({
            memberName: member.full_name,
            gymName,
            planName,
            endDate: m.end_date,
            kind: window.kind,
            daysUntilExpiry,
            membershipUrl: `${appUrl}/dashboard/member/membership`,
          }),
          text: renewalReminderEmailText({
            memberName: member.full_name,
            gymName,
            planName,
            endDate: m.end_date,
            kind: window.kind,
            daysUntilExpiry,
            membershipUrl: `${appUrl}/dashboard/member/membership`,
          }),
        });

        if (!emailResult.success) {
          console.error(`renewal-reminders: send failed for membership ${m.id}:`, emailResult);
        } else {
          sentAny = true;
        }
      }

      // WhatsApp via Meta's Cloud API — only for the day-of-expiry window,
      // asking the member to renew. Best-effort: doesn't block the email path.
      if (window.kind === "on_expiry" && member.phone) {
        const whatsappResult = await sendSubscriptionExpiredWhatsApp({
          phone: member.phone,
          memberName: member.full_name,
          gymName,
          planName,
          endDate: m.end_date,
          renewUrl: `${appUrl}/dashboard/member/membership`,
        });
        if (whatsappResult.success) sentAny = true;
      }

      if (!sentAny) continue;

      await admin.from("renewal_reminder_log").insert({ membership_id: m.id, reminder_type: window.type });
      sentCount++;
    }
    results[window.type] = sentCount;
  }

  return NextResponse.json({ success: true, sent: results });
}