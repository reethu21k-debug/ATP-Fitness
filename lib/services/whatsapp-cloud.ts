// ============================================================================
// WhatsApp Cloud API (Meta) — subscription lifecycle alerts
//
// Scope: this module powers exactly two notifications —
//   1. Subscription purchased  -> confirmation + duration
//   2. Subscription expired    -> expiry notice + renewal prompt
//
// It's intentionally separate from lib/services/whatsapp.ts (Twilio), which
// keeps powering the existing welcome-message / CRM / marketing-campaign
// sends elsewhere in the app. Scoping it this way means wiring up Meta's
// Cloud API for subscription alerts can't break any of those working flows.
//
// SETUP
//   1. Meta for Developers -> create an app -> add the "WhatsApp" product.
//   2. On WhatsApp > API Setup, grab:
//        - a token (temporary 24h token for testing, or a permanent System
//          User token from Business Settings for production)
//        - the "Phone number ID" (not the phone number itself)
//   3. .env.local:
//        WHATSAPP_CLOUD_API_TOKEN=EAAG...
//        WHATSAPP_CLOUD_PHONE_NUMBER_ID=123456789012345
//        WHATSAPP_CLOUD_API_VERSION=v21.0                        (optional)
//
// 24-HOUR SESSION WINDOW
//   Meta only allows free-form "text" messages to a user within 24 hours of
//   their last message to your business number. Both alerts here are
//   business-initiated (the member isn't mid-conversation), so in
//   production they must go out as pre-approved Message Templates, or Meta
//   will reject the send once a member is outside that window — which for
//   a subscription that just expired is basically always.
//
//   This module defaults to plain "text" sends so it works immediately
//   against a Meta test number during development. Once you've created and
//   had Meta approve templates in Business Manager, set these to switch a
//   given alert over to template sends automatically:
//        WHATSAPP_SUBSCRIPTION_CONFIRMED_TEMPLATE=subscription_confirmed
//        WHATSAPP_SUBSCRIPTION_EXPIRED_TEMPLATE=subscription_expired
//   Each template is expected to take its body variables in the same order
//   the plain-text version below lists them (see the calls to
//   sendWhatsAppCloudTemplate).
// ============================================================================

const GRAPH_API_VERSION = process.env.WHATSAPP_CLOUD_API_VERSION || "v21.0";

function getConfig() {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

// Meta expects the "to" field as digits only, country code first, no "+",
// spaces, or dashes (e.g. "919876543210").
function normalizePhone(phone: string) {
  return phone.replace(/^whatsapp:/, "").replace(/[^\d]/g, "");
}

type CloudSendResult = { success: true } | { success: false; skipped?: true; error?: string };

async function callGraphApi(phoneNumberId: string, token: string, body: Record<string, unknown>): Promise<CloudSendResult> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[whatsapp-cloud] send failed (${res.status}):`, errBody);
      return { success: false, error: `Meta API responded ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    console.error("[whatsapp-cloud] send failed", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function sendWhatsAppCloudText(toPhone: string, body: string): Promise<CloudSendResult> {
  const config = getConfig();
  if (!config) {
    console.warn(`[whatsapp-cloud] not configured — skipped message to ${toPhone}`);
    return { success: false, skipped: true };
  }

  return callGraphApi(config.phoneNumberId, config.token, {
    messaging_product: "whatsapp",
    to: normalizePhone(toPhone),
    type: "text",
    text: { body, preview_url: true },
  });
}

export async function sendWhatsAppCloudTemplate(
  toPhone: string,
  templateName: string,
  bodyParams: string[],
  languageCode = "en_US"
): Promise<CloudSendResult> {
  const config = getConfig();
  if (!config) {
    console.warn(`[whatsapp-cloud] not configured — skipped template "${templateName}" to ${toPhone}`);
    return { success: false, skipped: true };
  }

  return callGraphApi(config.phoneNumberId, config.token, {
    messaging_product: "whatsapp",
    to: normalizePhone(toPhone),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ----------------------------------------------------------------------------
// 1. Subscription purchased — confirmation + duration
// ----------------------------------------------------------------------------
export async function sendSubscriptionConfirmationWhatsApp(params: {
  phone: string;
  memberName: string;
  gymName: string;
  planName: string;
  durationDays: number;
  startDate: string;
  endDate: string;
}): Promise<CloudSendResult> {
  const { phone, memberName, gymName, planName, durationDays, startDate, endDate } = params;
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  const templateName = process.env.WHATSAPP_SUBSCRIPTION_CONFIRMED_TEMPLATE;
  if (templateName) {
    return sendWhatsAppCloudTemplate(phone, templateName, [
      memberName,
      planName,
      gymName,
      String(durationDays),
      start,
      end,
    ]);
  }

  const body =
    `Hi ${memberName}, your *${planName}* subscription at ${gymName} is confirmed! ✅\n\n` +
    `Duration: ${durationDays} day${durationDays === 1 ? "" : "s"}\n` +
    `Valid: ${start} – ${end}\n\n` +
    `Thanks for choosing ${gymName}. See you at the gym!`;

  return sendWhatsAppCloudText(phone, body);
}

// ----------------------------------------------------------------------------
// 2. Subscription expired — notice + renewal prompt
// ----------------------------------------------------------------------------
export async function sendSubscriptionExpiredWhatsApp(params: {
  phone: string;
  memberName: string;
  gymName: string;
  planName: string;
  endDate: string;
  renewUrl?: string;
}): Promise<CloudSendResult> {
  const { phone, memberName, gymName, planName, endDate, renewUrl } = params;
  const end = formatDate(endDate);

  const templateName = process.env.WHATSAPP_SUBSCRIPTION_EXPIRED_TEMPLATE;
  if (templateName) {
    return sendWhatsAppCloudTemplate(phone, templateName, [memberName, planName, gymName, end]);
  }

  const body =
    `Hi ${memberName}, your *${planName}* membership at ${gymName} expired on ${end}. ❌\n\n` +
    `Renew now to keep your access and pick up right where you left off.` +
    (renewUrl ? `\n\nRenew here: ${renewUrl}` : "");

  return sendWhatsAppCloudText(phone, body);
}
