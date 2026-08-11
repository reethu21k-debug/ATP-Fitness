// Supabase Edge Function — marketing-automation
// Runs once daily via pg_cron (see migration 0017_schedule_marketing_automation.sql).
// Two responsibilities, both idempotent via automated_message_log so nothing
// is ever sent twice for the same person on the same calendar day:
//   1. Birthday wishes — any active member whose date_of_birth matches
//      today's month/day, per-gym config (channel + template + optional coupon).
//   2. Festival offers — any festival_offers row whose occurs_on matches
//      today's month/day and hasn't already fired this calendar year.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "ATP Fitness <no-reply@atpfitness.in>";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://app.atpfitness.in";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  }).catch((err) => console.error("resend send failed", err));
}

async function sendWhatsApp(toPhone: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
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
  }).catch((err) => console.error("twilio send failed", err));
}

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

Deno.serve(async (req) => {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();
  const todayYear = today.getUTCFullYear();

  let birthdaysSent = 0;
  let festivalsSent = 0;

  // ==========================================================================
  // 1. BIRTHDAY WISHES
  // ==========================================================================
  const { data: birthdayConfigs } = await supabase
    .from("birthday_campaign_config")
    .select("gym_id, is_enabled, channel, message_template, coupon_id")
    .eq("is_enabled", true);

  for (const config of birthdayConfigs ?? []) {
    const { data: gym } = await supabase.from("gyms").select("name").eq("id", config.gym_id).single();

    // Fetch active members in this gym whose DOB matches today's month/day.
    // date_of_birth is stored as a real date, so we filter in JS after a
    // broad per-gym fetch (simplest cross-Postgres-version-safe approach for
    // "match month/day, ignore year" without a generated column).
    const { data: members } = await supabase
      .from("member_details")
      .select("profile_id, date_of_birth, profiles:profile_id(full_name, email, phone)")
      .eq("gym_id", config.gym_id)
      .eq("status", "active")
      .not("date_of_birth", "is", null);

    let coupon: { code: string } | null = null;
    if (config.coupon_id) {
      const { data: c } = await supabase.from("coupons").select("code").eq("id", config.coupon_id).single();
      coupon = c;
    }

    for (const m of members ?? []) {
      const dob = new Date(m.date_of_birth as string);
      if (dob.getUTCMonth() + 1 !== todayMonth || dob.getUTCDate() !== todayDay) continue;

      const profile = m.profiles as unknown as { full_name: string; email: string | null; phone: string | null } | null;
      if (!profile) continue;

      // Idempotency: skip if we already logged this member+automation+day.
      const { error: logError } = await supabase.from("automated_message_log").insert({
        gym_id: config.gym_id,
        member_id: m.profile_id,
        automation_type: "birthday",
        sent_on: todayStr,
      });
      if (logError) continue; // unique violation = already sent today

      const vars = { name: profile.full_name, gym_name: gym?.name ?? "ATP Fitness", coupon_code: coupon?.code ?? "" };
      const message = fillTemplate(config.message_template, vars);

      if ((config.channel === "email" || config.channel === "both") && profile.email) {
        await sendEmail(profile.email, `Happy Birthday, ${profile.full_name}! 🎉`, `<p>${message}</p>`);
      }
      if ((config.channel === "whatsapp" || config.channel === "both") && profile.phone) {
        await sendWhatsApp(profile.phone, message);
      }
      birthdaysSent++;
    }
  }

  // ==========================================================================
  // 2. FESTIVAL OFFERS
  // ==========================================================================
  const { data: festivals } = await supabase
    .from("festival_offers")
    .select("id, gym_id, name, occurs_on, message_template, channel, coupon_id, last_sent_year")
    .eq("is_active", true);

  for (const festival of festivals ?? []) {
    const occursOn = new Date(festival.occurs_on);
    if (occursOn.getUTCMonth() + 1 !== todayMonth || occursOn.getUTCDate() !== todayDay) continue;
    if (festival.last_sent_year === todayYear) continue; // already fired this year

    const { data: gym } = await supabase.from("gyms").select("name").eq("id", festival.gym_id).single();
    const { data: members } = await supabase
      .from("member_details")
      .select("profile_id, profiles:profile_id(full_name, email, phone)")
      .eq("gym_id", festival.gym_id)
      .eq("status", "active");

    let coupon: { code: string } | null = null;
    if (festival.coupon_id) {
      const { data: c } = await supabase.from("coupons").select("code").eq("id", festival.coupon_id).single();
      coupon = c;
    }

    for (const m of members ?? []) {
      const profile = m.profiles as unknown as { full_name: string; email: string | null; phone: string | null } | null;
      if (!profile) continue;

      const { error: logError } = await supabase.from("automated_message_log").insert({
        gym_id: festival.gym_id,
        member_id: m.profile_id,
        automation_type: `festival:${festival.id}`,
        sent_on: todayStr,
      });
      if (logError) continue;

      const vars = { name: profile.full_name, gym_name: gym?.name ?? "ATP Fitness", coupon_code: coupon?.code ?? "" };
      const message = fillTemplate(festival.message_template, vars);

      if ((festival.channel === "email" || festival.channel === "both") && profile.email) {
        await sendEmail(profile.email, festival.name, `<p>${message}</p>`);
      }
      if ((festival.channel === "whatsapp" || festival.channel === "both") && profile.phone) {
        await sendWhatsApp(profile.phone, message);
      }
      festivalsSent++;
    }

    if (festivalsSent > 0) {
      await supabase.from("festival_offers").update({ last_sent_year: todayYear }).eq("id", festival.id);
    }
  }

  return new Response(
    JSON.stringify({ success: true, birthdaysSent, festivalsSent, date: todayStr }),
    { headers: { "Content-Type": "application/json" } }
  );
});
