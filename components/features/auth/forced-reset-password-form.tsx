"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordSchema, type UpdatePasswordInput } from "@/lib/validations/auth";
import { updateOwnPassword } from "@/lib/actions/auth.actions";

// Shown right after a member/staff member logs in with a temporary
// password (must_reset_password === true). Unlike ResetPasswordForm this
// needs no token in the URL -- the person's active session is the proof
// of identity, so we just call updateOwnPassword directly.
export function ForcedResetPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<UpdatePasswordInput>({ resolver: zodResolver(updatePasswordSchema) });

  function onSubmit(values: UpdatePasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateOwnPassword(values);
      if (!result.success) return setServerError(result.error);
      // must_reset_password is now false -- bare "/dashboard" sends the
      // user to their role's home from here.
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You're signed in with a temporary password. Choose your own before continuing.
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
          Set password and continue
        </Button>
      </form>
    </div>
  );
}