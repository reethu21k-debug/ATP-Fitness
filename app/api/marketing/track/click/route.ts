import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Click-tracking redirect. Campaign links point here first
 * (?c=campaignId&r=recipientId&to=<encoded target URL>) so a click can be
 * recorded before forwarding the person on to the real destination. Public/
 * unauthenticated by design, same reasoning as the open-tracking pixel.
 */
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("c");
  const recipientId = req.nextUrl.searchParams.get("r");
  const to = req.nextUrl.searchParams.get("to");

  const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.atpfitness.in";
  const destination = to ? decodeURIComponent(to) : fallbackUrl;

  if (campaignId && recipientId) {
    try {
      const admin = createAdminClient();
      const { data: recipient } = await admin
        .from("campaign_recipients")
        .select("id, clicked_at")
        .eq("id", recipientId)
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (recipient && !recipient.clicked_at) {
        await admin
          .from("campaign_recipients")
          .update({ clicked_at: new Date().toISOString(), status: "clicked" })
          .eq("id", recipientId);

        await admin.rpc("increment_campaign_counter", { p_campaign_id: campaignId, p_column: "clicks_count" });
      }
    } catch {
      // Tracking must never block the redirect — swallow all errors.
    }
  }

  return NextResponse.redirect(destination);
}
