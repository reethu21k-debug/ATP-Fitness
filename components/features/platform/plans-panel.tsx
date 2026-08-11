"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanDialog } from "./plan-dialog";
import { listSubscriptionPlans, deactivateSubscriptionPlan } from "@/lib/actions/platform.actions";

export function PlansPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => listSubscriptionPlans(),
  });

  const plans = data?.success ? data.data ?? [] : [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
  }

  async function onDeactivate(planId: string) {
    await deactivateSubscriptionPlan(planId);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The platform&apos;s own pricing tiers — shown on the public pricing page and assignable to any tenant.
        </p>
        <PlanDialog onSaved={refresh} />
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading plans…</p>
      ) : plans.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No plans yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? "opacity-60" : undefined}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  {!plan.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
                <p className="text-2xl font-semibold">
                  ₹{plan.monthly_price.toLocaleString("en-IN")}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>{plan.max_gyms ?? "Unlimited"} gym{plan.max_gyms === 1 ? "" : "s"}</li>
                  <li>{plan.max_members ?? "Unlimited"} members</li>
                  <li>{plan.max_staff ?? "Unlimited"} staff</li>
                </ul>
                <div className="flex gap-2 pt-2">
                  <PlanDialog existing={plan} onSaved={refresh} />
                  {plan.is_active && (
                    <Button size="sm" variant="ghost" onClick={() => onDeactivate(plan.id)}>
                      Deactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
