"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { PlanDialog } from "./plan-dialog";
import { listMembershipPlans, setMembershipPlanActive, type MembershipPlanRow } from "@/lib/actions/plans.actions";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}

function PlanRow({ plan, onSaved }: { plan: MembershipPlanRow; onSaved: () => void }) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle(checked: boolean) {
    setToggling(true);
    await setMembershipPlanActive(plan.id, checked);
    setToggling(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3 border-b p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{plan.name}</p>
          {!plan.is_active && <Badge variant="secondary">Inactive</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatPrice(plan.price)} · {plan.duration_days} days
          {plan.description ? ` · ${plan.description}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={plan.is_active} disabled={toggling} onCheckedChange={handleToggle} />
          <span className="text-xs text-muted-foreground">{plan.is_active ? "Active" : "Inactive"}</span>
        </div>
        <PlanDialog
          plan={plan}
          onSaved={onSaved}
          trigger={
            <Button size="sm" variant="outline">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function PlansPanel() {
  const queryClient = useQueryClient();
  const { data: plans, isLoading, isError } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => listMembershipPlans(),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PlanDialog
          onSaved={refresh}
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              New plan
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : isError ? (
            <p className="p-6 text-center text-sm text-destructive">Couldn&apos;t load plans. Try again.</p>
          ) : plans?.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No membership plans yet — create your first one.
            </p>
          ) : (
            plans?.map((plan) => <PlanRow key={plan.id} plan={plan} onSaved={refresh} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}