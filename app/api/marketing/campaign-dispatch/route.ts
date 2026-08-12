import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { dispatchCampaign, sweepScheduledCampaigns } from "@/lib/services/marketing-dispatch";

// Node runtime -- nodemailer (the Gmail SMTP transport used everywhere else
// in this app, e.g. subscription/welcome/renewal emails) doesn't run on the
// Edge runtime.
export const runtime = "nodejs";

/**
 * POST /api/marketing/campaign-dispatch
 *
 * Replaces the old Resend-based `campaign-dispatch` Supabase Edge Function.
 * Sends exclusively through the shared Gmail SMTP transport
 * (lib/services/email.ts -> sendEmail) -- no Resend call anywhere in this
 * path.
 *
 * Reached in two ways:
 *   1. pg_cron sweep, once a minute, with no body -- picks up any campaign
 *      whose scheduled_at has arrived (see supabase/migrations).
 *   2. A manual/testing trigger with { campaignId } in the body.
 *
 * "Send now" campaigns from the dashboard are dispatched directly by
 * lib/actions/marketing.actions.ts, in the same Node process -- no HTTP
 * round trip needed there. This route exists for the cron sweep.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  let body: { campaignId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body -- this is the cron sweep for scheduled campaigns
  }

  if (body.campaignId) {
    const result = await dispatchCampaign(admin, body.campaignId);
    return NextResponse.json({ success: true, ...result });
  }

  const results = await sweepScheduledCampaigns(admin);
  return NextResponse.json({ success: true, dispatched: results.length, results });
}
