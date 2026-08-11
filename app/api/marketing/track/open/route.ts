import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// A 1x1 transparent GIF, served regardless of tracking outcome — email
// clients must never see a broken image or an error page.
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
);

/**
 * Email open-tracking pixel. Embedded as a 1x1 image in campaign emails
 * (see supabase/functions/campaign-dispatch). Public/unauthenticated by
 * design — email clients fetch this with no session — so it uses the
 * admin client and only ever increments counters, never exposes data back.
 */
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("c");
  const recipientId = req.nextUrl.searchParams.get("r");

  if (campaignId && recipientId) {
    try {
      const admin = createAdminClient();
      const { data: recipient } = await admin
        .from("campaign_recipients")
        .select("id, opened_at")
        .eq("id", recipientId)
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (recipient && !recipient.opened_at) {
        await admin
          .from("campaign_recipients")
          .update({ opened_at: new Date().toISOString(), status: "opened" })
          .eq("id", recipientId);

        // Only the first open per recipient increments the campaign counter —
        // opened_at is null-checked above, so a recipient reopening the same
        // email again never inflates opens_count.
        await admin.rpc("increment_campaign_counter", { p_campaign_id: campaignId, p_column: "opens_count" });
      }
    } catch {
      // Tracking must never break email rendering — swallow all errors.
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
