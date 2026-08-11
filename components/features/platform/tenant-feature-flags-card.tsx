"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { toggleTenantFeatureFlag } from "@/lib/actions/platform.actions";
import type { Tenant, FeatureFlagCatalogEntry } from "@/types/database";

export function TenantFeatureFlagsCard({
  tenant, catalog,
}: { tenant: Tenant; catalog: FeatureFlagCatalogEntry[] }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function isEnabled(flag: FeatureFlagCatalogEntry) {
    const override = tenant.feature_flags?.[flag.key];
    return override !== undefined ? override : flag.default_enabled;
  }

  function onToggle(flag: FeatureFlagCatalogEntry) {
    const next = !isEnabled(flag);
    setPendingKey(flag.key);
    startTransition(async () => {
      await toggleTenantFeatureFlag(tenant.id, flag.key, next);
      setPendingKey(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feature flags</CardTitle>
        <CardDescription>
          Per-tenant overrides. Flags left untouched use the platform default shown in parentheses.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {catalog.map((flag) => {
          const enabled = isEnabled(flag);
          const hasOverride = tenant.feature_flags?.[flag.key] !== undefined;
          return (
            <button
              key={flag.key}
              onClick={() => onToggle(flag)}
              disabled={isPending && pendingKey === flag.key}
              className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent/40 disabled:opacity-60"
            >
              <div>
                <p className="text-sm font-medium">{flag.label}</p>
                <p className="text-xs text-muted-foreground">
                  {flag.description}
                  {!hasOverride && ` (default: ${flag.default_enabled ? "on" : "off"})`}
                </p>
              </div>
              <span
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                  enabled ? "bg-primary" : "bg-secondary"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4.5 w-4.5 transform rounded-full bg-background shadow transition-transform",
                    enabled ? "translate-x-6" : "translate-x-1"
                  )}
                  style={{ height: "1.125rem", width: "1.125rem" }}
                />
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
