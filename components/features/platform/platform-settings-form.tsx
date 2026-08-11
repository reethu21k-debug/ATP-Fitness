"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePlatformSettings } from "@/lib/actions/platform.actions";
import type { PlatformSettings } from "@/types/database";

interface FormValues {
  platformName: string;
  supportEmail: string;
  defaultTrialDays: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowNewRegistrations: boolean;
}

export function PlatformSettingsForm({ settings }: { settings: PlatformSettings }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      platformName: settings.platform_name,
      supportEmail: settings.support_email ?? "",
      defaultTrialDays: settings.default_trial_days,
      maintenanceMode: settings.maintenance_mode,
      maintenanceMessage: settings.maintenance_message ?? "",
      allowNewRegistrations: settings.allow_new_registrations,
    },
  });

  const maintenanceMode = watch("maintenanceMode");

  function onSubmit(values: FormValues) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePlatformSettings(values);
      if (!result.success) return setError(result.error);
      setSaved(true);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform settings</CardTitle>
        <CardDescription>Global configuration that applies across every tenant.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Platform name</Label>
            <Input {...register("platformName", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Support email</Label>
            <Input type="email" {...register("supportEmail")} placeholder="support@atpfitness.in" />
          </div>
          <div className="space-y-1.5">
            <Label>Default trial length (days)</Label>
            <Input type="number" {...register("defaultTrialDays", { required: true })} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("allowNewRegistrations")} className="h-4 w-4 rounded border-input" />
              Allow new gym registrations
            </label>
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...register("maintenanceMode")} className="h-4 w-4 rounded border-input" />
              Maintenance mode
            </label>
            <p className="text-xs text-muted-foreground">
              When enabled, show a maintenance banner platform-wide. This does not block logins by itself — pair it
              with your own deploy process if you need a hard lockout.
            </p>
          </div>
          {maintenanceMode && (
            <div className="col-span-2 space-y-1.5">
              <Label>Maintenance message</Label>
              <Input {...register("maintenanceMessage")} placeholder="We're upgrading ATP Fitness — back shortly." />
            </div>
          )}
          {error && <p className="col-span-2 text-sm text-destructive">{error}</p>}
          {saved && <p className="col-span-2 text-sm text-success">Settings saved.</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" loading={isPending}>
            Save settings
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
