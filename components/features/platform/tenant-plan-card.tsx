"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { changeTenantPlan } from "@/lib/actions/platform.actions";
import type { Tenant, SubscriptionPlan } from "@/types/database";

export function TenantPlanCard({ tenant, plans }: { tenant: Tenant; plans: SubscriptionPlan[] }) {
  const router = useRouter();
  const [planCode, setPlanCode] = useState(tenant.subscription_plan);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentPlan = plans.find((p) => p.code === tenant.subscription_plan);
  const dirty = planCode !== tenant.subscription_plan;

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await changeTenantPlan(tenant.id, planCode);
      if (!result.success) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscription plan</CardTitle>
        <CardDescription>
          Currently on <span className="font-medium capitalize">{currentPlan?.name ?? tenant.subscription_plan}</span>
          {currentPlan && ` · ₹${currentPlan.monthly_price.toLocaleString("en-IN")}/mo`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={planCode}
          onChange={(e) => setPlanCode(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} — ₹{p.monthly_price.toLocaleString("en-IN")}/mo
            </option>
          ))}
        </Select>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter>
        <Button size="sm" disabled={!dirty} loading={isPending} onClick={onSave}>
          Change plan
        </Button>
      </CardFooter>
    </Card>
  );
}
