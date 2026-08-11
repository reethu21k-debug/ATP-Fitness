"use client";

import { useEffect, useState, useCallback } from "react";
import { format, subDays } from "date-fns";
import { Building2, Users, UserCheck, TrendingUp, MapPin, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { BranchDialog } from "./branch-dialog";
import { BranchComparisonChart } from "./branch-comparison-chart";
import {
  listBranches, setBranchActive, getBranchComparison, getTenantCombinedOverview,
} from "@/lib/actions/branches.actions";
import type { Gym, BranchComparisonRow, TenantCombinedOverview } from "@/types/database";

export function BranchesDashboard() {
  const [branches, setBranches] = useState<Gym[]>([]);
  const [activeGymId, setActiveGymId] = useState<string | null>(null);
  const [overview, setOverview] = useState<TenantCombinedOverview | null>(null);
  const [comparison, setComparison] = useState<BranchComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const start = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const end = format(new Date(), "yyyy-MM-dd");

    const [branchesRes, overviewRes, comparisonRes] = await Promise.all([
      listBranches(),
      getTenantCombinedOverview(),
      getBranchComparison(start, end),
    ]);

    if (branchesRes.success && branchesRes.data) {
      setBranches(branchesRes.data.branches);
      setActiveGymId(branchesRes.data.activeGymId);
    }
    if (overviewRes.success) setOverview(overviewRes.data ?? null);
    if (comparisonRes.success) setComparison(comparisonRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive(gym: Gym) {
    await setBranchActive(gym.id, !gym.is_active);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Branches" value={overview?.total_gyms ?? "—"} icon={Building2} />
        <StatCard label="Active branches" value={overview?.active_gyms ?? "—"} icon={MapPin} tone="success" />
        <StatCard label="Members (all branches)" value={overview?.total_members ?? "—"} icon={Users} />
        <StatCard label="Staff (all branches)" value={overview?.total_staff ?? "—"} icon={UserCheck} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Revenue this month vs. last
            </div>
            <p className="text-2xl font-semibold">₹{(overview?.revenue_this_month ?? 0).toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">
              Last month: ₹{(overview?.revenue_last_month ?? 0).toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <BranchComparisonChart rows={comparison} loading={loading} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Branches</h2>
        <BranchDialog onSaved={load} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => {
          const stats = comparison.find((c) => c.gym_id === b.id);
          return (
            <Card key={b.id} className={b.id === activeGymId ? "ring-2 ring-primary" : ""}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold">
                      {b.name}
                      {b.id === activeGymId && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{b.code}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {b.city && <p className="text-sm text-muted-foreground">{b.city}{b.state ? `, ${b.state}` : ""}</p>}

                <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  <div>
                    <p className="text-sm font-semibold">{stats?.member_count ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">Members</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{stats?.staff_count ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">Staff</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">₹{(stats?.revenue ?? 0).toLocaleString("en-IN")}</p>
                    <p className="text-[11px] text-muted-foreground">30d revenue</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <BranchDialog existing={b} onSaved={load} />
                  <button
                    onClick={() => handleToggleActive(b)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {b.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
