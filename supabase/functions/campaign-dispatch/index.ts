// Supabase Edge Function — campaign-dispatch
// Two ways to reach this function:
//   1. Directly invoked by a Server Action right after a campaign is created
//      with no scheduled_at (send-now), passed a campaignId.
//   2. Run once a minute via pg_cron (see migration
//      0017_schedule_marketing_automation.sql) with no body, to pick up any
//      campaign whose scheduled_at has arrived.
// Either way, the actual send logic is identical: resolve the audience,
// insert one campaign_recipients row per person (unique constraint prevents
// double-sends if this ever runs twice for the same campaign), then send.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "ATP Fitness <no-reply@atpfitness.in>";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://app.atpfitness.in";

type SupabaseClient = ReturnType<typeof createClient>;

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) return { success: false, error: `Resend error ${res.status}` };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function sendWhatsApp(toPhone: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return { success: false, error: "Twilio not configured" };
  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM ?? "",
        To: `whatsapp:${toPhone}`,
        Body: body,
      }),
    });
    if (!res.ok) return { success: false, error: `Twilio error ${res.status}` };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Resolves a campaign's audience_type into a flat list of recipients. */
async function resolveAudience(supabase: SupabaseClient, campaign: any) {
  const gymId = campaign.gym_id;

  if (campaign.audience_type === "leads") {
    const { data } = await supabase
      .from("leads")
      .select("id, name, email, phone")
      .eq("gym_id", gymId)
      .not("status", "in", "(converted,lost)");
    return (data ?? []).map((l: any) => ({ leadId: l.id, memberId: null, name: l.name, email: l.email, phone: l.phone }));
  }

  if (campaign.audience_type === "custom_selection") {
    const ids = campaign.audience_member_ids ?? [];
    if (ids.length === 0) return [];
    const { data } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
    return (data ?? []).map((p: any) => ({ leadId: null, memberId: p.id, name: p.full_name, email: p.email, phone: p.phone }));
  }

  // Member-based audiences: query member_details joined with profiles, then
  // filter in JS by membership status where needed (keeps this one code path
  // instead of five near-duplicate queries).
  const { data: members } = await supabase
    .from("member_details")
    .select("profile_id, status, profiles:profile_id(full_name, email, phone)")
    .eq("gym_id", gymId);

  let filtered = members ?? [];
  if (campaign.audience_type === "active_members") {
    filtered = filtered.filter((m: any) => m.status === "active");
  } else if (campaign.audience_type === "expired_members") {
    filtered = filtered.filter((m: any) => m.status === "expired");
  } else if (campaign.audience_type === "frozen_members") {
    filtered = filtered.filter((m: any) => m.status === "frozen");
  } else if (campaign.audience_type === "expiring_soon") {
    const { data: expiring } = await supabase
      .from("members_overview")
      .select("profile_id")
      .eq("gym_id", gymId)
      .gte("days_until_expiry", 0)
      .lte("days_until_expiry", 7);
    const expiringIds = new Set((expiring ?? []).map((e: any) => e.profile_id));
    filtered = filtered.filter((m: any) => expiringIds.has(m.profile_id));
  }
  // 'all_members' falls through with no extra filter.

  return filtered
    .map((m: any) => {
      const profile = m.profiles as { full_name: string; email: string | null; phone: string | null } | null;
      if (!profile) return null;
      return { leadId: null, memberId: m.profile_id, name: profile.full_name, email: profile.email, phone: profile.phone };
    })
    .filter(Boolean) as { leadId: string | null; memberId: string | null; name: string; email: string | null; phone: string | null }[];
}

async function dispatchCampaign(supabase: SupabaseClient, campaignId: string) {
  const { data: campaign, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) return { campaignId, error: "Campaign not found" };
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { campaignId, skipped: true, reason: `already ${campaign.status}` };
  }

  await supabase.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);

  const audience = await resolveAudience(supabase, campaign);

  // Insert recipient rows up front (unique constraint dedupes any re-run).
  if (audience.length > 0) {
    await supabase.from("campaign_recipients").insert(
      audience.map((r) => ({
        campaign_id: campaignId,
        gym_id: campaign.gym_id,
        member_id: r.memberId,
        lead_id: r.leadId,
        recipient_name: r.name,
        recipient_email: r.email,
        recipient_phone: r.phone,
        channel: campaign.channel,
        status: "pending",
      }))
    );
  }

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients ?? []) {
    const personalizedMessage = campaign.message_body.replace(/\{\{\s*name\s*\}\}/g, recipient.recipient_name);
    let anySent = false;
    let lastError: string | null = null;

    if ((campaign.channel === "email" || campaign.channel === "both") && recipient.recipient_email) {
      const trackingPixel = `<img src="${APP_URL}/api/marketing/track/open?c=${campaignId}&r=${recipient.id}" width="1" height="1" style="display:none" alt="" />`;
      const result = await sendEmail(
        recipient.recipient_email,
        campaign.subject || campaign.name,
        `<div>${personalizedMessage}</div>${trackingPixel}`
      );
      if (result.success) anySent = true;
      else lastError = result.error ?? "Email send failed";
    }

    if ((campaign.channel === "whatsapp" || campaign.channel === "both") && recipient.recipient_phone) {
      const result = await sendWhatsApp(recipient.recipient_phone, personalizedMessage);
      if (result.success) anySent = true;
      else lastError = lastError ?? result.error ?? "WhatsApp send failed";
    }

    if (anySent) {
      await supabase
        .from("campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);
      sentCount++;
    } else {
      await supabase
        .from("campaign_recipients")
        .update({ status: "failed", error_message: lastError ?? "No valid contact channel" })
        .eq("id", recipient.id);
      failedCount++;
    }
  }

  await supabase
    .from("marketing_campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipients_total: audience.length,
      recipients_sent: sentCount,
      recipients_failed: failedCount,
    })
    .eq("id", campaignId);

  return { campaignId, recipientsTotal: audience.length, sentCount, failedCount };
}

Deno.serve(async (req) => {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: { campaignId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body — this is the cron sweep for scheduled campaigns
  }

  if (body.campaignId) {
    const result = await dispatchCampaign(supabase, body.campaignId);
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cron sweep: find every campaign whose scheduled_at has arrived.
  const { data: due } = await supabase
    .from("marketing_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  const results = [];
  for (const campaign of due ?? []) {
    results.push(await dispatchCampaign(supabase, campaign.id));
  }

  return new Response(JSON.stringify({ success: true, dispatched: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
