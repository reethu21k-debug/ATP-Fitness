"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTenantWhiteLabel } from "@/lib/actions/platform.actions";
import type { Tenant } from "@/types/database";

export function TenantWhiteLabelCard({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [isWhiteLabel, setIsWhiteLabel] = useState(tenant.is_white_label);
  const [customDomain, setCustomDomain] = useState(tenant.custom_domain ?? "");
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(tenant.primary_color);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateTenantWhiteLabel(tenant.id, {
        isWhiteLabel: isWhiteLabel,
        customDomain,
        logoUrl,
        primaryColor,
      });
      if (!result.success) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">White-label branding</CardTitle>
        <CardDescription>Custom domain and branding instead of default ATP Fitness styling.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isWhiteLabel}
            onChange={(e) => setIsWhiteLabel(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Enable white-label for this tenant
        </label>
        <div className="space-y-1.5">
          <Label>Custom domain</Label>
          <Input
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="app.theirgym.com"
            disabled={!isWhiteLabel}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Logo URL</Label>
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
            disabled={!isWhiteLabel}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={!isWhiteLabel}
              className="h-10 w-14 rounded-lg border border-input bg-background disabled:opacity-50"
            />
            <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={!isWhiteLabel} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter>
        <Button size="sm" loading={isPending} onClick={onSave}>
          Save branding
        </Button>
      </CardFooter>
    </Card>
  );
}
