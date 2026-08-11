"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emailLoginSchema,
  twoFactorVerifySchema,
  type EmailLoginInput,
  type TwoFactorVerifyInput,
} from "@/lib/validations/auth";
import { loginWithEmail, verifyTwoFactorLogin } from "@/lib/actions/auth.actions";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type Mode = "email" | "mfa";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo");
  const [mode, setMode] = useState<Mode>("email");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const emailForm = useForm<EmailLoginInput>({ resolver: zodResolver(emailLoginSchema) });
  const mfaForm = useForm<TwoFactorVerifyInput>({ resolver: zodResolver(twoFactorVerifySchema) });

  async function finishLogin() {
    router.push(redirectTo || "/dashboard");
    router.refresh();
  }

  async function onEmailSubmit(values: EmailLoginInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await loginWithEmail(values);
      if (!result.success) return setServerError(result.error);
      if (result.data?.mfaRequired) {
        const supabase = createClient();
        const { data } = await supabase.auth.mfa.listFactors();
        const totp = data?.totp?.[0];
        if (totp) {
          setMfaFactorId(totp.id);
          setMode("mfa");
          return;
        }
      }
      finishLogin();
    });
  }

  async function onMfaSubmit(values: TwoFactorVerifyInput) {
    if (!mfaFactorId) return;
    setServerError(null);
    startTransition(async () => {
      const result = await verifyTwoFactorLogin(mfaFactorId, values);
      if (!result.success) return setServerError(result.error);
      finishLogin();
    });
  }

  if (mode === "mfa") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Two-factor verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Authentication code</Label>
            <Input id="code" inputMode="numeric" maxLength={6} placeholder="000000" {...mfaForm.register("code")} />
            {mfaForm.formState.errors.code && (
              <p className="text-sm text-destructive">{mfaForm.formState.errors.code.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" className="w-full" loading={isPending}>
            Verify and continue
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your ATP Fitness account.</p>
      </div>

      <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@atpfitness.in" {...emailForm.register("email")} />
          {emailForm.formState.errors.email && (
            <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" {...emailForm.register("password")} />
          {emailForm.formState.errors.password && (
            <p className="text-sm text-destructive">{emailForm.formState.errors.password.message}</p>
          )}
        </div>
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" className="w-full" loading={isPending}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Not a member yet?{" "}
        <Link href="/contact" className="font-medium text-primary hover:underline">
          Book a free trial
        </Link>
      </p>
    </div>
  );
}