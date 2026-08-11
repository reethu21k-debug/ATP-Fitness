import { Building2, Users, IndianRupee, TrendingUp, AlertTriangle, Ticket } from "lucide-react";
import { getPlatformOverviewStats, getPlatformTicketStats } from "@/lib/actions/platform.actions";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { TenantGrowthChart } from "./tenant-growth-chart";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function PlatformOverview() {
  const [statsRes, ticketRes] = await Promise.all([getPlatformOverviewStats(), getPlatformTicketStats()]);

  const stats = statsRes.success
    ? statsRes.data
    : {
        total_tenants: 0,
        active_tenants: 0,
        trialing_tenants: 0,
        suspended_tenants: 0,
        past_due_tenants: 0,
        total_gyms: 0,
        total_members: 0,
        mrr: 0,
      };

  const tickets = ticketRes.success
    ? ticketRes.data
    : { open_count: 0, in_progress_count: 0, resolved_count: 0, closed_count: 0, urgent_open_count: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every gym, every tenant, one dashboard — subscriptions, revenue, and support at a glance.
        </p>
      </div>

      {!statsRes.success && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {statsRes.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tenants" value={stats?.total_tenants ?? 0} icon={Building2} />
        <StatCard label="Active subscriptions" value={stats?.active_tenants ?? 0} icon={TrendingUp} tone="success" />
        <StatCard label="MRR" value={`₹${(stats?.mrr ?? 0).toLocaleString("en-IN")}`} icon={IndianRupee} tone="success" />
        <StatCard label="Total members (platform-wide)" value={stats?.total_members ?? 0} icon={Users} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trialing" value={stats?.trialing_tenants ?? 0} icon={Building2} />
        <StatCard label="Past due" value={stats?.past_due_tenants ?? 0} icon={AlertTriangle} tone="warning" />
        <StatCard label="Suspended" value={stats?.suspended_tenants ?? 0} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Total gyms/branches" value={stats?.total_gyms ?? 0} icon={Building2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TenantGrowthChart />
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Support tickets</CardTitle>
            <Link href="/dashboard/platform/tickets" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Ticket className="h-4 w-4" /> Open
              </span>
              <span className="font-medium">{tickets?.open_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">In progress</span>
              <span className="font-medium">{tickets?.in_progress_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Resolved</span>
              <span className="font-medium">{tickets?.resolved_count ?? 0}</span>
            </div>
            {(tickets?.urgent_open_count ?? 0) > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Urgent &amp; open
                </span>
                <span className="font-semibold">{tickets?.urgent_open_count ?? 0}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
