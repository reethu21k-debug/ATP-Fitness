import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/components/features/platform/subscription-status-badge";
import { CreditCard } from "lucide-react";
import { format } from "date-fns";
import type { SubscriptionPlan, Tenant } from "@/types/database";

export async function SubscriptionInfoCard({ tenantId }: { tenantId: string }) {
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return null;

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("code", (tenant as Tenant).subscription_plan)
    .maybeSingle();

  const t = tenant as Tenant;
  const p = plan as SubscriptionPlan | null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" /> Subscription
        </CardTitle>
        <CardDescription>Your current ATP Fitness plan and billing status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Plan</span>
          <span className="text-sm font-medium">{p?.name ?? t.subscription_plan}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <SubscriptionStatusBadge status={t.subscription_status} />
        </div>
        {p && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-sm font-medium">₹{p.monthly_price.toLocaleString("en-IN")}/mo</span>
          </div>
        )}
        {t.trial_ends_at && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Trial ends</span>
            <span className="text-sm font-medium">{format(new Date(t.trial_ends_at), "dd MMM yyyy")}</span>
          </div>
        )}
        {t.subscription_status === "suspended" && (
          <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
            Your account is suspended. Contact support below to resolve this.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
