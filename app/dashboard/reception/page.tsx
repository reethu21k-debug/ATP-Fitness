import Link from "next/link";
import { Users, UserCheck, Clock, Plus } from "lucide-react";
import { getMemberDashboardStats } from "@/lib/actions/member.actions";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard — ATP Fitness" };

export default async function ReceptionDashboardPage() {
  const stats = await getMemberDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Front desk</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add walk-ins and manage today's members.</p>
        </div>
        <Button asChild className="sm:shrink-0">
          <Link href="/dashboard/reception/members/new"><Plus className="h-4 w-4" /> Add member</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total members" value={stats.totalMembers} icon={Users} />
        <StatCard label="Active members" value={stats.activeMembers} icon={UserCheck} tone="success" />
        <StatCard label="Expiring in 7 days" value={stats.expiringSoon} icon={Clock} tone="warning" />
      </div>

      <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        QR attendance and appointments open here as those modules ship. The{" "}
        <Link href="/dashboard/reception/members" className="text-primary hover:underline">Members</Link> section
        is fully live.
      </div>
    </div>
  );
}
