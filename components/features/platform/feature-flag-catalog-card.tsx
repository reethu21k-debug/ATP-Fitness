"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { upsertFeatureFlagCatalogEntry } from "@/lib/actions/platform.actions";
import type { FeatureFlagCatalogEntry } from "@/types/database";

interface FormValues {
  key: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
}

export function FeatureFlagCatalogCard({ catalog }: { catalog: FeatureFlagCatalogEntry[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { category: "general", defaultEnabled: false },
  });

  function onSubmit(values: FormValues) {
    setError(null);
    startTransition(async () => {
      const result = await upsertFeatureFlagCatalogEntry(values);
      if (!result.success) return setError(result.error);
      reset();
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Feature flag catalog</CardTitle>
          <CardDescription>The registry of flags available to toggle per-tenant.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" /> New flag
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Key</Label>
                <Input {...register("key", { required: true })} placeholder="new_feature_key" />
              </div>
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input {...register("label", { required: true })} placeholder="New Feature" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Description</Label>
                <Input {...register("description")} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("category")}>
                  <option value="general">General</option>
                  <option value="ai">AI</option>
                  <option value="billing">Billing</option>
                  <option value="branding">Branding</option>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register("defaultEnabled")} className="h-4 w-4 rounded border-input" />
                  Enabled by default
                </label>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={isPending}>
                Save flag
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <ul className="space-y-2">
          {catalog.map((flag) => (
            <li key={flag.key} className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">{flag.label}</p>
                <p className="text-xs text-muted-foreground">{flag.description}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{flag.category}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5">
                  {flag.default_enabled ? "Default: on" : "Default: off"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
