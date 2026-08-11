import { z } from "zod";

export const emailLoginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
export type EmailLoginInput = z.infer<typeof emailLoginSchema>;

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter phone number in international format, e.g. +919876543210.");

export const phoneOtpRequestSchema = z.object({ phone: phoneSchema });
export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>;

export const phoneOtpVerifySchema = z.object({
  phone: phoneSchema,
  token: z.string().length(6, "Enter the 6-digit code."),
});
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;

export const registerGymSchema = z
  .object({
    ownerName: z.string().min(2, "Enter your full name."),
    email: z.string().email("Enter a valid email address."),
    phone: phoneSchema,
    gymName: z.string().min(2, "Enter your gym's name."),
    city: z.string().min(2, "Enter a city."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the Terms of Service." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type RegisterGymInput = z.infer<typeof registerGymSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset link is invalid or missing."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// For an already-signed-in user (e.g. must_reset_password after first login
// with a temporary password) -- no token involved, the session itself is
// the authorization.
export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export const twoFactorVerifySchema = z.object({
  code: z.string().length(6, "Enter the 6-digit authenticator code."),
});
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;