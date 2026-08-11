// Supabase Edge Function — crm-follow-up-reminders
// Runs once daily via pg_cron (see migration 0012_schedule_crm_reminders.sql).
// Groups leads whose follow_up_date is today by their assigned staff member
// and sends each of them a single summary email — not one email per lead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "ATP Fitness <no-reply@atpfitness.in>";
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://app.atpfitness.in";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  }).catch((err) => console.error("resend send failed", err));
}

Deno.serve(async (req) => {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, phone, status, assigned_to, profiles:assigned_to(full_name, email)")
    .eq("follow_up_date", today)
    .not("status", "in", "(converted,lost)");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const byStaff = new Map<string, { email: string; name: string; leads: { name: string; phone: string; status: string }[] }>();

  for (const lead of leads ?? []) {
    const staff = lead.profiles as unknown as { full_name: string; email: string | null } | null;
    if (!lead.assigned_to || !staff?.email) continue;
    if (!byStaff.has(lead.assigned_to)) {
      byStaff.set(lead.assigned_to, { email: staff.email, name: staff.full_name, leads: [] });
    }
    byStaff.get(lead.assigned_to)!.leads.push({ name: lead.name, phone: lead.phone, status: lead.status });
  }

  let emailsSent = 0;
  for (const { email, name, leads: staffLeads } of byStaff.values()) {
    const rows = staffLeads
      .map((l) => `<li>${l.name} — ${l.phone} <span style="color:#888">(${l.status.replace("_", " ")})</span></li>`)
      .join("");
    await sendEmail(
      email,
      `${staffLeads.length} follow-up${staffLeads.length > 1 ? "s" : ""} due today`,
      `<p>Hi ${name},</p><p>You have ${staffLeads.length} lead follow-up(s) scheduled for today:</p><ul>${rows}</ul><p><a href="${APP_URL}/dashboard/reception/crm">Open the pipeline</a></p>`
    );
    emailsSent++;
  }

  return new Response(JSON.stringify({ success: true, staffNotified: emailsSent, leadsDue: leads?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
