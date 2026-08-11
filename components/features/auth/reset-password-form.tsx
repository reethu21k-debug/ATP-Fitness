"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { resetPassword } from "@/lib/actions/auth.actions";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? "" },
  });

  // No token in the URL at all — the person likely opened this page directly
  // rather than via the emailed link. Nothing to redeem, so don't show a form.
  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Reset link missing</h1>
        <p className="text-sm text-muted-foreground">
          This page needs a valid reset link. Request a new one from the forgot password page.
        </p>
        <Link href="/forgot-password" className="inline-block text-sm font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await resetPassword({ ...values, token: token! });
      if (!result.success) return setServerError(result.error);
      router.push("/login?reset=success");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password you haven't used before.
        </p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" placeholder="••••••••" {...form.register("confirmPassword")} />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" className="w-full" loading={isPending}>
          Update password
        </Button>
      </form>
    </div>
  );
}