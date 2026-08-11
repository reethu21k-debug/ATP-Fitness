"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendEmail, resetPasswordEmailHtml, resetPasswordEmailText } from "@/lib/services/email";
import {
  emailLoginSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  registerGymSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  twoFactorVerifySchema,
  type EmailLoginInput,
  type PhoneOtpRequestInput,
  type PhoneOtpVerifyInput,
  type RegisterGymInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type UpdatePasswordInput,
  type TwoFactorVerifyInput,
} from "@/lib/validations/auth";

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function zodFieldErrors(error: import("zod").ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] = issue.message;
  return out;
}

// ============================================================================
// EMAIL LOGIN
// ============================================================================
export async function loginWithEmail(input: EmailLoginInput): Promise<ActionResult<{ mfaRequired: boolean }>> {
  const parsed = emailLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { success: false, error: "Incorrect email or password." };
  }

  // Check if this user has an active MFA factor requiring a second step.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel;

  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  revalidatePath("/", "layout");
  return { success: true, data: { mfaRequired: !!mfaRequired } };
}

// ============================================================================
// PHONE OTP
// ============================================================================
export async function requestPhoneOtp(input: PhoneOtpRequestInput): Promise<ActionResult> {
  const parsed = phoneOtpRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });
  if (error) return { success: false, error: "Could not send code. Check the number and try again." };
  return { success: true };
}

export async function verifyPhoneOtp(input: PhoneOtpVerifyInput): Promise<ActionResult> {
  const parsed = phoneOtpVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });
  if (error) return { success: false, error: "That code is incorrect or expired." };

  revalidatePath("/", "layout");
  return { success: true };
}

// ============================================================================
// OAUTH (Google / Apple)
// ============================================================================
export async function signInWithOAuth(provider: "google" | "apple") {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${appUrl}/api/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth_failed");
  redirect(data.url);
}

// ============================================================================
// REGISTER GYM (creates tenant + gym + owner profile in one flow)
// ============================================================================
export async function registerGym(input: RegisterGymInput): Promise<ActionResult<{ tenantId: string }>> {
  const parsed = registerGymSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please check the form for errors.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { ownerName, email, phone, gymName, city, password } = parsed.data;

  const admin = createAdminClient();

  // 1. Create the auth user (owner) via admin API, pre-confirmed.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    phone,
    email_confirm: true,
    user_metadata: { full_name: ownerName, role: "gym_owner" },
  });
  if (authError || !authUser.user) {
    return { success: false, error: authError?.message ?? "Could not create your account." };
  }

  const slug = gymName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .concat("-", Math.random().toString(36).slice(2, 6));

  // 2. Create the tenant
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ name: gymName, slug, owner_id: authUser.user.id, billing_email: email })
    .select()
    .single();

  if (tenantError || !tenant) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: "Could not set up your gym account. Please try again." };
  }

  // 3. Create the first gym/branch
  const { data: gym, error: gymError } = await admin
    .from("gyms")
    .insert({ tenant_id: tenant.id, name: gymName, code: "MAIN", city, email, phone })
    .select()
    .single();

  if (gymError || !gym) {
    await admin.from("tenants").delete().eq("id", tenant.id);
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: "Could not set up your gym location. Please try again." };
  }

  // 4. Attach the owner's profile to the tenant + gym
  await admin
    .from("profiles")
    .update({ tenant_id: tenant.id, gym_id: gym.id, role: "gym_owner", full_name: ownerName, phone })
    .eq("id", authUser.user.id);

  // 5. Sign them in immediately
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });

  return { success: true, data: { tenantId: tenant.id } };
}

// ============================================================================
// FORGOT / RESET PASSWORD
//
// Custom token flow (does not use Supabase Auth's built-in
// resetPasswordForEmail / recovery-session mechanism):
//  1. forgotPassword: look up the user by email, generate a random token,
//     store only its SHA-256 hash + an expiry in password_reset_tokens,
//     email the RAW token as a link via Gmail SMTP.
//  2. resetPassword: hash the submitted token, find a matching unused,
//     unexpired row, update the user's password with the service-role
//     admin client (no session needed), mark the token used.
// ============================================================================

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const admin = createAdminClient();
  const email = parsed.data.email.toLowerCase().trim();

  // Look up the user via profiles (has email + full_name) rather than
  // paging through admin.auth.admin.listUsers().
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();

  // Always report success either way â€” never reveal whether an email is
  // registered. Only actually send mail if we found a matching account.
  if (profile) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    const { error: insertError } = await admin.from("password_reset_tokens").insert({
      user_id: profile.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("forgotPassword: could not insert password_reset_tokens row:", insertError.message);
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      const emailResult = await sendEmail({
        to: profile.email,
        subject: "Reset your password",
        html: resetPasswordEmailHtml({ name: profile.full_name, resetUrl }),
        text: resetPasswordEmailText({ name: profile.full_name, resetUrl }),
      });
      if (!emailResult.success) {
        console.error("forgotPassword: sendEmail did not succeed:", emailResult);
      } else {
        console.log(`forgotPassword: reset email sent to ${profile.email}`);
      }
    }
  } else {
    console.warn(`forgotPassword: no profile found for email "${email}" â€” silently skipping (by design).`);
  }

  return { success: true };
}

export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const admin = createAdminClient();
  const tokenHash = hashToken(parsed.data.token);

  const { data: tokenRow, error: lookupError } = await admin
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (lookupError || !tokenRow || tokenRow.used_at) {
    return { success: false, error: "This reset link is invalid or has already been used. Request a new one." };
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { success: false, error: "This reset link has expired. Request a new one." };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(tokenRow.user_id, {
    password: parsed.data.password,
  });
  if (updateError) {
    return { success: false, error: "Could not update your password. Request a new reset link." };
  }

  // Mark the token used so it can't be replayed, and clear the forced-reset flag.
  await admin.from("password_reset_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRow.id);
  await admin.from("profiles").update({ must_reset_password: false }).eq("id", tokenRow.user_id);

  return { success: true };
}

// For a user who is already signed in (e.g. logged in with the temporary
// password from their welcome email and must_reset_password is true).
// Uses their own session -- no token needed, being logged in is the proof.
export async function updateOwnPassword(input: UpdatePasswordInput): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { success: false, error: "Could not update your password. Try again." };
  }

  await supabase.from("profiles").update({ must_reset_password: false }).eq("id", user.id);

  revalidatePath("/", "layout");
  return { success: true };
}

// ============================================================================
// TWO-FACTOR AUTHENTICATION (TOTP via Supabase MFA)
// ============================================================================
export async function enrollTwoFactor(): Promise<
  ActionResult<{ factorId: string; qrCode: string; secret: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "ATP Fitness Authenticator" });
  if (error || !data) return { success: false, error: "Could not start 2FA setup." };

  return {
    success: true,
    data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
  };
}

export async function confirmTwoFactorEnrollment(
  factorId: string,
  input: TwoFactorVerifyInput
): Promise<ActionResult> {
  const parsed = twoFactorVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return { success: false, error: "Could not verify. Try again." };

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (error) return { success: false, error: "That code is incorrect." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ two_factor_enabled: true }).eq("id", user.id);

  return { success: true };
}

export async function verifyTwoFactorLogin(factorId: string, input: TwoFactorVerifyInput): Promise<ActionResult> {
  const parsed = twoFactorVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return { success: false, error: "Could not verify. Try again." };

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (error) return { success: false, error: "That code is incorrect." };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function disableTwoFactor(factorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { success: false, error: "Could not disable 2FA." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ two_factor_enabled: false }).eq("id", user.id);

  return { success: true };
}

// ============================================================================
// SIGN OUT
// ============================================================================
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
