import twilio from "twilio";
import type { Twilio } from "twilio";

let client: Twilio | null = null;
let clientInitAttempted = false;

// Twilio's SDK constructor throws synchronously if accountSid isn't in the
// expected "AC..." format — even when both env vars are present (e.g. a
// placeholder/misconfigured value in a preview environment). Constructing
// eagerly at module scope meant that error could crash any page that
// imports this module, including during `next build`'s page-data
// collection. Instead, validate the shape and construct lazily/defensively.
function getClient(): Twilio | null {
  if (clientInitAttempted) return client;
  clientInitAttempted = true;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token || !/^AC[a-zA-Z0-9]+$/.test(sid)) {
    if (sid || token) {
      console.warn("[whatsapp] TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN present but invalid — WhatsApp sending disabled");
    }
    return null;
  }

  try {
    client = twilio(sid, token);
  } catch (err) {
    console.error("[whatsapp] failed to initialize Twilio client", err);
    client = null;
  }
  return client;
}

export async function sendWhatsAppMessage(toPhone: string, body: string) {
  const client = getClient();
  if (!client) {
    console.warn(`[whatsapp] Twilio not configured — skipped message to ${toPhone}`);
    return { success: false as const, skipped: true as const };
  }

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${toPhone}`,
      body,
    });
    return { success: true as const };
  } catch (err) {
    console.error("[whatsapp] send failed", err);
    return { success: false as const, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export function memberWelcomeWhatsAppMessage(params: {
  memberName: string;
  gymName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { memberName, gymName, email, temporaryPassword, loginUrl } = params;
  return (
    `Welcome to ${gymName}, ${memberName}! 🏋️\n\n` +
    `Your ATP Fitness account is ready.\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\n` +
    `Log in here: ${loginUrl}\nYou'll be asked to set a new password on first login.`
  );
}

export function staffWelcomeWhatsAppMessage(params: {
  staffName: string;
  gymName: string;
  role: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { staffName, gymName, role, email, temporaryPassword, loginUrl } = params;
  return (
    `Welcome to the team at ${gymName}, ${staffName}! 👋\n\n` +
    `You've been added as a ${role}.\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\n` +
    `Log in here: ${loginUrl}\nYou'll be asked to set a new password on first login.`
  );
}

export async function sendRenewalReminderWhatsApp(toPhone: string, memberName: string, daysLeft: number, gymName: string) {
  const body =
    daysLeft > 0
      ? `Hi ${memberName}, your membership at ${gymName} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew soon to avoid a break in access.`
      : `Hi ${memberName}, your membership at ${gymName} has expired. Renew today to keep your progress going.`;
  return sendWhatsAppMessage(toPhone, body);
}
