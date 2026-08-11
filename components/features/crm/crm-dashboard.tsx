import { Users, TrendingUp, UserCheck, Clock } from "lucide-react";
import { listLeadsByStatus, getCrmStats, getDueFollowUpsToday } from "@/lib/actions/crm.actions";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { NewLeadDialog } from "@/components/features/crm/new-lead-dialog";
import { PipelineBoard } from "@/components/features/crm/pipeline-board";
import { Card, CardContent } from "@/components/ui/card";

export async function CrmDashboard({ basePath }: { basePath: string }) {
  const [leadsByStatus, stats, dueToday] = await Promise.all([
    listLeadsByStatus(),
    getCrmStats(),
    getDueFollowUpsToday(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads &amp; CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Walk-ins, trials, and conversions in one pipeline.</p>
        </div>
        <div className="sm:shrink-0">
          <NewLeadDialog />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total leads" value={stats.totalLeads} icon={Users} />
        <StatCard label="New this week" value={stats.newThisWeek} icon={TrendingUp} tone="success" />
        <StatCard label="Converted" value={stats.converted} icon={UserCheck} tone="success" />
        <StatCard label="Conversion rate" value={`${stats.conversionRate}%`} icon={TrendingUp} tone="warning" />
      </div>

      {dueToday.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-4 w-4 text-warning" />
            <p className="text-sm">
              <span className="font-medium">{dueToday.length} follow-up{dueToday.length > 1 ? "s" : ""}</span> due today:{" "}
              {dueToday.map((l) => l.name).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      <PipelineBoard leadsByStatus={leadsByStatus} basePath={basePath} />
    </div>
  );
}
