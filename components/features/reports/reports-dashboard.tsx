import { IndianRupee, TrendingDown, TrendingUp, Users, QrCode } from "lucide-react";
import { getReportsSummary } from "@/lib/actions/reports.actions";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { ReportsTabs } from "./reports-tabs";

export async function ReportsDashboard() {
  const result = await getReportsSummary();
  const summary = result.success
    ? result.data
    : { monthRevenue: 0, monthExpenses: 0, monthProfit: 0, activeMembers: 0, monthCheckIns: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports &amp; Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue, attendance, membership, trainer, inventory, payments, expenses, and profit &amp; loss —
          exportable as PDF or Excel.
        </p>
      </div>

      {!result.success && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {result.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Revenue (this month)" value={`₹${(summary?.monthRevenue ?? 0).toLocaleString("en-IN")}`} icon={IndianRupee} tone="success" />
        <StatCard label="Expenses (this month)" value={`₹${(summary?.monthExpenses ?? 0).toLocaleString("en-IN")}`} icon={TrendingDown} tone="warning" />
        <StatCard
          label="Profit (this month)"
          value={`₹${(summary?.monthProfit ?? 0).toLocaleString("en-IN")}`}
          icon={TrendingUp}
          tone={(summary?.monthProfit ?? 0) >= 0 ? "success" : "destructive"}
        />
        <StatCard label="Active members" value={summary?.activeMembers ?? 0} icon={Users} />
        <StatCard label="Check-ins (this month)" value={summary?.monthCheckIns ?? 0} icon={QrCode} />
      </div>

      <ReportsTabs />
    </div>
  );
}
