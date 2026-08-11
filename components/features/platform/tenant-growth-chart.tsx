"use client";

import { useEffect, useState } from "react";
import { format, subMonths } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getPlatformTenantGrowth } from "@/lib/actions/platform.actions";
import type { PlatformTenantGrowthRow } from "@/types/database";

export function TenantGrowthChart() {
  const [rows, setRows] = useState<PlatformTenantGrowthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"new" | "cumulative">("cumulative");

  useEffect(() => {
    const now = new Date();
    const start = format(subMonths(now, 11), "yyyy-MM-01");
    const end = format(now, "yyyy-MM-dd");
    getPlatformTenantGrowth(start, end).then((res) => {
      if (res.success) setRows(res.data ?? []);
      setLoading(false);
    });
  }, []);

  const chartData = rows.map((r) => ({
    label: format(new Date(r.month), "MMM yy"),
    new_tenants: r.new_tenants,
    cumulative_tenants: r.cumulative_tenants,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Tenant growth (last 12 months)</CardTitle>
        <div className="inline-flex gap-1 rounded-lg bg-secondary/60 p-1">
          <button
            onClick={() => setView("cumulative")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              view === "cumulative" ? "bg-background shadow-soft" : "text-muted-foreground"
            }`}
          >
            Total
          </button>
          <button
            onClick={() => setView("new")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              view === "new" ? "bg-background shadow-soft" : "text-muted-foreground"
            }`}
          >
            New / month
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No tenant data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            {view === "cumulative" ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="cumulative_tenants" stroke="hsl(var(--primary))" strokeWidth={2} name="Total tenants" dot={false} />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="new_tenants" fill="hsl(var(--primary))" name="New tenants" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
