import { Megaphone, Send, Ticket, Users2, Sparkles } from "lucide-react";
import { getMarketingStats } from "@/lib/actions/marketing.actions";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { MarketingTabs } from "./marketing-tabs";

export async function MarketingDashboard({ basePath, canManage }: { basePath: string; canManage: boolean }) {
  const stats = await getMarketingStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Campaigns, coupons, referrals, and automated offers.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Campaigns" value={stats.totalCampaigns} icon={Megaphone} />
        <StatCard label="Messages sent" value={stats.totalSent} icon={Send} tone="success" />
        <StatCard label="Active coupons" value={stats.activeCoupons} icon={Ticket} tone="warning" />
        <StatCard label="Pending referrals" value={stats.pendingReferrals} icon={Users2} />
        <StatCard label="Avg. open rate" value={`${stats.avgOpenRate}%`} icon={Sparkles} tone="success" />
      </div>

      <MarketingTabs basePath={basePath} canManage={canManage} />
    </div>
  );
}
