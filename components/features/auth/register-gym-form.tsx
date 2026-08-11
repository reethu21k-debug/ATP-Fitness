"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerGymSchema, type RegisterGymInput } from "@/lib/validations/auth";
import { registerGym } from "@/lib/actions/auth.actions";
import Link from "next/link";

export function RegisterGymForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<RegisterGymInput>({
    resolver: zodResolver(registerGymSchema),
  });

  function onSubmit(values: RegisterGymInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await registerGym(values);
      if (!result.success) return setServerError(result.error);
      router.push("/dashboard/owner");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your ATP Fitness account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the owner account for ATP Fitness on the platform.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ownerName">Your name</Label>
            <Input id="ownerName" placeholder="Full name" {...form.register("ownerName")} />
            {form.formState.errors.ownerName && (
              <p className="text-sm text-destructive">{form.formState.errors.ownerName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="gymName">Gym name</Label>
            <Input id="gymName" placeholder="ATP Fitness" {...form.register("gymName")} />
            {form.formState.errors.gymName && (
              <p className="text-sm text-destructive">{form.formState.errors.gymName.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@atpfitness.in" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="+919876543210" {...form.register("phone")} />
            {form.formState.errors.phone && (
              <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" placeholder="Anantapur" {...form.register("city")} />
            {form.formState.errors.city && (
              <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" {...form.register("confirmPassword")} />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            id="agreeToTerms"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-input"
            {...form.register("agreeToTerms")}
          />
          <Label htmlFor="agreeToTerms" className="text-sm font-normal text-muted-foreground">
            I agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </Label>
        </div>
        {form.formState.errors.agreeToTerms && (
          <p className="text-sm text-destructive">{form.formState.errors.agreeToTerms.message}</p>
        )}

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button type="submit" className="w-full" loading={isPending}>
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}