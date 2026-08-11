"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Sparkles } from "lucide-react";
import {
  getGrowthAnalytics, getRenewalRateAnalytics, getRetentionAnalytics, type DateRange,
} from "@/lib/actions/reports.actions";
import { getLatestForecast } from "@/lib/actions/ai.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import type { GrowthAnalyticsRow, RenewalRateRow, RetentionRow } from "@/types/database";

interface ForecastRow { forecast_month: string; projected_revenue: number }

export function AnalyticsPanel({ range, onRangeChange }: { range: DateRangeValue; onRangeChange: (r: DateRangeValue) => void }) {
  const [growth, setGrowth] = useState<GrowthAnalyticsRow[]>([]);
  const [renewal, setRenewal] = useState<RenewalRateRow[]>([]);
  const [retention, setRetention] = useState<RetentionRow[]>([]);
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getGrowthAnalytics(range as DateRange),
      getRenewalRateAnalytics(range as DateRange),
      getRetentionAnalytics(),
      getLatestForecast(),
    ]).then(([g, r, ret, f]) => {
      setGrowth(g.success ? g.data ?? [] : []);
      setRenewal(r.success ? r.data ?? [] : []);
      setRetention(ret.success ? ret.data ?? [] : []);
      setForecast((f as ForecastRow[]) ?? []);
      setLoading(false);
    });
  }, [range]);

  const growthData = growth.map((r) => ({ ...r, label: format(new Date(r.month), "MMM yy") }));
  const renewalData = renewal.map((r) => ({ ...r, label: format(new Date(r.month), "MMM yy") }));
  const retentionData = [...retention].reverse().map((r) => ({ ...r, label: `${r.cohort_months_ago}mo ago` }));
  const forecastData = forecast.map((r) => ({ ...r, label: format(new Date(r.forecast_month), "MMM yy") }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Retention, growth, and renewal trends derived from real membership data.</p>
        <DateRangePicker value={range} onChange={onRangeChange} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Member growth</h3>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : growthData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="new_members" fill="hsl(var(--success))" name="New" radius={[3, 3, 0, 0]} />
                <Bar dataKey="churned_members" fill="hsl(var(--destructive))" name="Churned" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Renewal rate</h3>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : renewalData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No memberships expiring in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={renewalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} unit="%" stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="renewal_rate" stroke="hsl(var(--primary))" strokeWidth={2} name="Renewal rate" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Retention by joining cohort</h3>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : retentionData.every((r) => r.cohort_size === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Not enough joining history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={retentionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} unit="%" stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="retention_rate" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} name="Retention" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Revenue forecast
            </h3>
            <Link href="/dashboard/owner/insights" className="text-xs text-primary hover:underline">
              Run / view in AI Insights →
            </Link>
          </div>
          {forecastData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No forecast computed yet — run one from AI Insights.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Line type="monotone" dataKey="projected_revenue" stroke="hsl(var(--warning))" strokeWidth={2} name="Projected revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  );
}
