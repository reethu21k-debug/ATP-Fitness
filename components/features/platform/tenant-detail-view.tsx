import { getTenantDetail, listSubscriptionPlans, listFeatureFlagCatalog } from "@/lib/actions/platform.actions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "./subscription-status-badge";
import { TenantAdminActions } from "./tenant-admin-actions";
import { TenantPlanCard } from "./tenant-plan-card";
import { TenantFeatureFlagsCard } from "./tenant-feature-flags-card";
import { TenantWhiteLabelCard } from "./tenant-white-label-card";
import { Building2, Users, UserCog, IndianRupee, Clock } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";

export async function TenantDetailView({ tenantId }: { tenantId: string }) {
  const [detailRes, plansRes, flagsRes] = await Promise.all([
    getTenantDetail(tenantId),
    listSubscriptionPlans(),
    listFeatureFlagCatalog(),
  ]);

  if (!detailRes.success || !detailRes.data) notFound();

  const { tenant, usage, recentActions } = detailRes.data;
  const plans = plansRes.success ? plansRes.data ?? [] : [];
  const flagCatalog = flagsRes.success ? flagsRes.data ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
            <SubscriptionStatusBadge status={tenant.subscription_status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            /{tenant.slug} · joined {format(new Date(tenant.created_at), "dd MMM yyyy")}
          </p>
        </div>
        <TenantAdminActions tenant={tenant} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <UsageStat label="Gyms" value={usage.gym_count} icon={Building2} />
        <UsageStat label="Staff" value={usage.staff_count} icon={UserCog} />
        <UsageStat label="Members" value={usage.member_count} icon={Users} />
        <UsageStat label="Active members" value={usage.active_member_count} icon={Users} />
        <UsageStat label="Total revenue" value={`₹${usage.total_revenue.toLocaleString("en-IN")}`} icon={IndianRupee} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TenantPlanCard tenant={tenant} plans={plans} />
        <TenantWhiteLabelCard tenant={tenant} />
      </div>

      <TenantFeatureFlagsCard tenant={tenant} catalog={flagCatalog} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin action history</CardTitle>
          <CardDescription>Suspensions, reactivations, plan changes, and feature-flag toggles for this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No admin actions recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentActions.map((a) => (
                <li key={a.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{a.action.replace(/_/g, " ")}</p>
                    {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
                    {Object.keys(a.metadata ?? {}).length > 0 && (
                      <p className="text-xs text-muted-foreground">{JSON.stringify(a.metadata)}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "dd MMM, HH:mm")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageStat({
  label, value, icon: Icon,
}: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
