import nodemailer from "nodemailer";

// ============================================================================
// EMAIL TRANSPORT -- Resend (primary) with Gmail SMTP fallback
//
// RESEND (preferred): a domain-verified transactional provider. Requires
// SPF/DKIM/DMARC set up for your sending domain in the Resend dashboard --
// once verified, mail sent through it lands in the inbox at a completely
// different rate than personal-Gmail-relay mail, because it's authenticated
// as coming from your own business domain instead of a consumer address.
//
// .env.local:
//   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
//   EMAIL_FROM=ATP Fitness <no-reply@atpfitness.in>   (must be on a domain verified in Resend)
//
// Same env var names/shape as the existing renewal-reminders Edge Function's
// Resend usage, so both pipelines share one provider and one domain.
//
// GMAIL SMTP (fallback): used automatically if RESEND_API_KEY isn't set --
// keeps local/dev environments working without a Resend account, and is a
// safety net if Resend is ever unreachable. Requires a Gmail account with
// 2-Step Verification and an "App Password" (Google Account -> Security ->
// 2-Step Verification -> App passwords) -- a normal Gmail password will NOT
// work, Google blocks plain SMTP auth for those.
//
// .env.local (fallback only):
//   GMAIL_SMTP_USER=youraddress@gmail.com
//   GMAIL_SMTP_APP_PASSWORD=xxxxxxxxxxxxxxxx   (16-character app password, no spaces)
//   EMAIL_FROM_NAME=ATP Fitness                (optional, display name only)
//
// DELIVERABILITY NOTE: sending via a personal @gmail.com account through
// SMTP has a real ceiling on inbox placement, no matter how the content is
// written -- Gmail's filters are inherently warier of automated, templated
// mail from a consumer address than from a verified business domain. This
// is exactly why Resend is checked first; Gmail SMTP here is a fallback,
// not the primary path.
// ============================================================================

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM ?? "ATP Fitness <no-reply@atpfitness.in>";

const gmailUser = process.env.GMAIL_SMTP_USER;
const gmailAppPassword = process.env.GMAIL_SMTP_APP_PASSWORD;

const transporter =
  gmailUser && gmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailAppPassword },
      })
    : null;

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendViaResend({ to, subject, html, text }: SendEmailInput) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: emailFrom, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API responded ${res.status}: ${body}`);
  }

  return res.json() as Promise<{ id: string }>;
}

async function sendViaGmail({ to, subject, html, text }: SendEmailInput) {
  if (!transporter || !gmailUser) return null;

  const fromName = process.env.EMAIL_FROM_NAME ?? "ATP Fitness";

  await transporter.sendMail({
    from: `"${fromName}" <${gmailUser}>`,
    to,
    subject,
    html,
    // A plain-text alternative is not optional for deliverability --
    // HTML-only mail (no multipart/alternative) is itself a spam signal
    // most filters check for, independent of what the content says.
    text,
  });
  return true;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  // Resend first, whenever it's configured.
  if (resendApiKey) {
    try {
      await sendViaResend({ to, subject, html, text });
      return { success: true as const };
    } catch (err) {
      console.error("[email] Resend send failed, falling back to Gmail SMTP if configured:", err);
      // fall through to Gmail below rather than failing outright --
      // a transient Resend outage shouldn't silently drop the email if
      // Gmail is still set up as a backup.
    }
  }

  if (!transporter || !gmailUser) {
    if (!resendApiKey) {
      console.warn(`[email] Neither RESEND_API_KEY nor GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD configured -- skipped email to ${to}: "${subject}"`);
    }
    return { success: false as const, skipped: true as const };
  }

  try {
    await sendViaGmail({ to, subject, html, text });
    return { success: true as const };
  } catch (err) {
    console.error("[email] send failed", err);
    return { success: false as const, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Shared footer -- a real gym name/contact line in every email is a basic
// legitimacy signal (and standard practice even for transactional mail).
function emailFooterHtml(gymName: string) {
  return `
    <p style="color: #999; font-size: 12px; line-height: 1.6; margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee;">
      ${gymName} · This is a one-time message about your account. If something looks wrong, just reply to this email.
    </p>`;
}

function emailFooterText(gymName: string) {
  return `\n—\n${gymName}\nThis is a one-time message about your account. If something looks wrong, just reply to this email.`;
}

export function memberWelcomeEmailHtml(params: {
  memberName: string;
  gymName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { memberName, gymName, email, temporaryPassword, loginUrl } = params;
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #111;">Welcome to ${gymName}, ${memberName}</h2>
    <p style="color: #444; line-height: 1.6;">
      Your account is ready. Log in below to see your membership, workouts, attendance, and payments in one place.
    </p>
    <div style="background: #f4f4f7; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 4px 0; color: #111;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 4px 0; color: #111;"><strong>Temporary password:</strong> <code style="background:#e8e8ef; padding:2px 6px; border-radius:4px;">${temporaryPassword}</code></p>
    </div>
    <a href="${loginUrl}" style="display: inline-block; background: #6366F1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 4px;">
      Log in to your account
    </a>
    <p style="color: #444; line-height: 1.6; margin-top: 20px;">
      Sign in with the email and temporary password above — you'll be prompted to set your own password right after.
    </p>
    ${emailFooterHtml(gymName)}
  </div>`;
}

export function memberWelcomeEmailText(params: {
  memberName: string;
  gymName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { memberName, gymName, email, temporaryPassword, loginUrl } = params;
  return `Welcome to ${gymName}, ${memberName}

Your account is ready. Log in to see your membership, workouts, attendance, and payments in one place.

Log in: ${loginUrl}
Email: ${email}
Temporary password: ${temporaryPassword}
You'll be prompted to set your own password right after signing in.
${emailFooterText(gymName)}`;
}

export function staffWelcomeEmailHtml(params: {
  staffName: string;
  gymName: string;
  role: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { staffName, gymName, role, email, temporaryPassword, loginUrl } = params;
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #111;">Welcome to the team at ${gymName}, ${staffName}</h2>
    <p style="color: #444; line-height: 1.6;">
      You've been added as a <strong>${role}</strong>. Your account is ready — log in below to get started.
    </p>
    <div style="background: #f4f4f7; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 4px 0; color: #111;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 4px 0; color: #111;"><strong>Temporary password:</strong> <code style="background:#e8e8ef; padding:2px 6px; border-radius:4px;">${temporaryPassword}</code></p>
    </div>
    <a href="${loginUrl}" style="display: inline-block; background: #6366F1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 4px;">
      Log in to your account
    </a>
    <p style="color: #444; line-height: 1.6; margin-top: 20px;">
      Sign in with the email and temporary password above — you'll be prompted to set your own password right after.
    </p>
    ${emailFooterHtml(gymName)}
  </div>`;
}

export function staffWelcomeEmailText(params: {
  staffName: string;
  gymName: string;
  role: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { staffName, gymName, role, email, temporaryPassword, loginUrl } = params;
  return `Welcome to the team at ${gymName}, ${staffName}

You've been added as a ${role}. Your account is ready.

Log in: ${loginUrl}
Email: ${email}
Temporary password: ${temporaryPassword}
You'll be prompted to set your own password right after signing in.
${emailFooterText(gymName)}`;
}

function formatEmailDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDuration(days: number) {
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;
    return `${months} month${months > 1 ? "s" : ""}`;
  }
  return `${days} day${days > 1 ? "s" : ""}`;
}

export function subscriptionConfirmationEmailHtml(params: {
  memberName: string;
  gymName: string;
  planName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  amountPaid: number;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  invoiceUrl?: string | null;
}) {
  const { memberName, gymName, planName, startDate, endDate, durationDays, amountPaid, paymentDate, paymentMethod, invoiceUrl } = params;

  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #111;">You're all set, ${memberName}</h2>
    <p style="color: #444; line-height: 1.6;">
      Your <strong>${planName}</strong> membership at ${gymName} is active. Here's a summary for your records:
    </p>
    <div style="background: #f4f4f7; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 4px 0; color: #111;"><strong>Plan:</strong> ${planName}</p>
      <p style="margin: 4px 0; color: #111;"><strong>Duration:</strong> ${formatDuration(durationDays)}</p>
      <p style="margin: 4px 0; color: #111;"><strong>Start date:</strong> ${formatEmailDate(startDate)}</p>
      <p style="margin: 4px 0; color: #111;"><strong>End date:</strong> ${formatEmailDate(endDate)}</p>
      <p style="margin: 4px 0; color: #111;"><strong>Amount paid:</strong> ₹${amountPaid.toFixed(2)}</p>
      ${paymentDate ? `<p style="margin: 4px 0; color: #111;"><strong>Payment date:</strong> ${formatEmailDate(paymentDate)}</p>` : ""}
      ${paymentMethod ? `<p style="margin: 4px 0; color: #111; text-transform: capitalize;"><strong>Payment method:</strong> ${paymentMethod}</p>` : ""}
    </div>
    ${
      invoiceUrl
        ? `<a href="${invoiceUrl}" style="display: inline-block; background: #6366F1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 4px;">
      Download invoice
    </a>`
        : `<p style="color: #888; font-size: 13px; line-height: 1.6;">Your invoice will be available once your first payment is recorded.</p>`
    }
    <p style="color: #444; line-height: 1.6; margin-top: 20px;">
      Questions about your membership? Just reply to this email or reach out to ${gymName} directly.
    </p>
    ${emailFooterHtml(gymName)}
  </div>`;
}

export function subscriptionConfirmationEmailText(params: {
  memberName: string;
  gymName: string;
  planName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  amountPaid: number;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  invoiceUrl?: string | null;
}) {
  const { memberName, gymName, planName, startDate, endDate, durationDays, amountPaid, paymentDate, paymentMethod, invoiceUrl } = params;

  return `You're all set, ${memberName}

Your ${planName} membership at ${gymName} is active. Summary:

Plan: ${planName}
Duration: ${formatDuration(durationDays)}
Start date: ${formatEmailDate(startDate)}
End date: ${formatEmailDate(endDate)}
Amount paid: Rs. ${amountPaid.toFixed(2)}
${paymentDate ? `Payment date: ${formatEmailDate(paymentDate)}\n` : ""}${paymentMethod ? `Payment method: ${paymentMethod}\n` : ""}
${invoiceUrl ? `Download your invoice: ${invoiceUrl}` : "Your invoice will be available once your first payment is recorded."}

Questions? Just reply to this email or reach out to ${gymName} directly.
${emailFooterText(gymName)}`;
}

export function resetPasswordEmailHtml(params: { name?: string | null; resetUrl: string; gymName?: string }) {
  const { name, resetUrl, gymName = "your gym" } = params;
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #111;">Reset your password${name ? `, ${name}` : ""}</h2>
    <p style="color: #444; line-height: 1.6;">
      We received a request to reset your password. Click below to choose a new one.
      This link expires in 1 hour and can only be used once.
    </p>
    <a href="${resetUrl}" style="display: inline-block; background: #6366F1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 12px;">
      Set a new password
    </a>
    <p style="color: #888; font-size: 13px; line-height: 1.6; margin-top: 20px;">
      If you didn't request this, you can safely ignore this email — your password won't be changed.
    </p>
    ${emailFooterHtml(gymName)}
  </div>`;
}

export function resetPasswordEmailText(params: { name?: string | null; resetUrl: string; gymName?: string }) {
  const { name, resetUrl, gymName = "your gym" } = params;
  return `Reset your password${name ? `, ${name}` : ""}

We received a request to reset your password. Use the link below to choose a new one.
This link expires in 1 hour and can only be used once.

${resetUrl}

If you didn't request this, you can safely ignore this email — your password won't be changed.
${emailFooterText(gymName)}`;
}

// ============================================================================
// MEMBERSHIP RENEWAL REMINDERS
//
// Four automated windows: 7 days before, 3 days before, 1 day before, and
// the day the membership actually expires. "manual" is a fifth kind used
// only when an admin/receptionist clicks "Send reminder" by hand -- it can
// fire regardless of how many days are left (including well after expiry).
// ============================================================================

export type RenewalReminderKind = "before_7d" | "before_3d" | "before_1d" | "on_expiry" | "manual";

function renewalReminderCopy(kind: RenewalReminderKind, daysUntilExpiry: number) {
  switch (kind) {
    case "before_7d":
      return { urgency: "expires in 7 days", subjectVerb: "expires in 7 days" };
    case "before_3d":
      return { urgency: "expires in 3 days", subjectVerb: "expires in 3 days" };
    case "before_1d":
      return { urgency: "expires tomorrow", subjectVerb: "expires tomorrow" };
    case "on_expiry":
      return { urgency: "expires today", subjectVerb: "expires today" };
    case "manual":
    default:
      return daysUntilExpiry >= 0
        ? { urgency: `expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`, subjectVerb: "needs your attention" }
        : { urgency: `expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) === 1 ? "" : "s"} ago`, subjectVerb: "has expired" };
  }
}

export function renewalReminderEmailSubject(params: { gymName: string; kind: RenewalReminderKind; daysUntilExpiry: number }) {
  const { gymName, kind, daysUntilExpiry } = params;
  const { subjectVerb } = renewalReminderCopy(kind, daysUntilExpiry);
  return `Your membership at ${gymName} ${subjectVerb}`;
}

export function renewalReminderEmailHtml(params: {
  memberName: string;
  gymName: string;
  planName: string;
  endDate: string;
  kind: RenewalReminderKind;
  daysUntilExpiry: number;
  membershipUrl: string;
}) {
  const { memberName, gymName, planName, endDate, kind, daysUntilExpiry, membershipUrl } = params;
  const { urgency } = renewalReminderCopy(kind, daysUntilExpiry);
  const isExpired = kind === "on_expiry" || (kind === "manual" && daysUntilExpiry < 0);

  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #111;">Hi ${memberName}, your membership ${urgency}</h2>
    <p style="color: #444; line-height: 1.6;">
      Your <strong>${planName}</strong> membership at ${gymName} ${urgency} on <strong>${formatEmailDate(endDate)}</strong>.
      ${isExpired ? "Renew today to keep your access and progress going." : "Renew soon to avoid any break in access."}
    </p>
    <a href="${membershipUrl}" style="display: inline-block; background: #6366F1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 4px;">
      ${isExpired ? "Renew now" : "View my membership"}
    </a>
    <p style="color: #444; line-height: 1.6; margin-top: 20px;">
      Questions? Just reply to this email or reach out to ${gymName} directly.
    </p>
    ${emailFooterHtml(gymName)}
  </div>`;
}

export function renewalReminderEmailText(params: {
  memberName: string;
  gymName: string;
  planName: string;
  endDate: string;
  kind: RenewalReminderKind;
  daysUntilExpiry: number;
  membershipUrl: string;
}) {
  const { memberName, gymName, planName, endDate, kind, daysUntilExpiry, membershipUrl } = params;
  const { urgency } = renewalReminderCopy(kind, daysUntilExpiry);
  const isExpired = kind === "on_expiry" || (kind === "manual" && daysUntilExpiry < 0);

  return `Hi ${memberName}, your membership ${urgency}

Your ${planName} membership at ${gymName} ${urgency} on ${formatEmailDate(endDate)}.
${isExpired ? "Renew today to keep your access and progress going." : "Renew soon to avoid any break in access."}

${membershipUrl}

Questions? Just reply to this email or reach out to ${gymName} directly.
${emailFooterText(gymName)}`;
}
