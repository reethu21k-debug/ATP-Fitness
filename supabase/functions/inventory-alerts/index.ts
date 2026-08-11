// Supabase Edge Function — inventory-alerts
// Runs weekly via pg_cron (see migration 0015_schedule_inventory_alerts.sql).
// Emails each gym owner a digest of low-stock and soon-to-expire items —
// one email per gym, not one per item.

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

  const { data: items, error } = await supabase
    .from("inventory_overview")
    .select("gym_id, name, quantity, low_stock_threshold, expiry_date, is_low_stock, is_expiring_soon")
    .or("is_low_stock.eq.true,is_expiring_soon.eq.true");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const byGym = new Map<string, { low: typeof items; expiring: typeof items }>();
  for (const item of items ?? []) {
    if (!byGym.has(item.gym_id)) byGym.set(item.gym_id, { low: [], expiring: [] });
    const bucket = byGym.get(item.gym_id)!;
    if (item.is_low_stock) bucket.low.push(item);
    if (item.is_expiring_soon) bucket.expiring.push(item);
  }

  let emailsSent = 0;
  for (const [gymId, { low, expiring }] of byGym.entries()) {
    const { data: gym } = await supabase.from("gyms").select("name, email").eq("id", gymId).single();
    const { data: owner } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("gym_id", gymId)
      .eq("role", "gym_owner")
      .maybeSingle();

    const to = owner?.email ?? gym?.email;
    if (!to) continue;

    const lowRows = low.map((i: any) => `<li>${i.name} — ${i.quantity} left (threshold ${i.low_stock_threshold})</li>`).join("");
    const expiringRows = expiring.map((i: any) => `<li>${i.name} — expires ${i.expiry_date}</li>`).join("");

    await sendEmail(
      to,
      `Inventory alert: ${low.length} low stock, ${expiring.length} expiring soon`,
      `<p>Hi ${owner?.full_name ?? "there"},</p>
       ${low.length ? `<p><strong>Low stock:</strong></p><ul>${lowRows}</ul>` : ""}
       ${expiring.length ? `<p><strong>Expiring within 30 days:</strong></p><ul>${expiringRows}</ul>` : ""}
       <p><a href="${APP_URL}/dashboard/owner/inventory">Open inventory</a></p>`
    );
    emailsSent++;
  }

  return new Response(JSON.stringify({ success: true, gymsNotified: emailsSent }), {
    headers: { "Content-Type": "application/json" },
  });
});
