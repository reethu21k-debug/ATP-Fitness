"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
import type { MemberProgress } from "@/types/database";
import { Select } from "@/components/ui/select";

type Range = "week" | "month" | "year";
type Metric = "weight_kg" | "body_fat_pct" | "waist_cm";

const METRIC_LABEL: Record<Metric, string> = {
  weight_kg: "Weight (kg)",
  body_fat_pct: "Body fat (%)",
  waist_cm: "Waist (cm)",
};

export function ProgressChart({ entries }: { entries: MemberProgress[] }) {
  const [range, setRange] = useState<Range>("month");
  const [metric, setMetric] = useState<Metric>("weight_kg");

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = { week: 84, month: 365, year: 365 * 3 }[range] * 86400000;
    return entries
      .filter((e) => now - new Date(e.recorded_at).getTime() <= cutoff)
      .map((e) => ({ date: format(new Date(e.recorded_at), range === "year" ? "MMM yy" : "dd MMM"), value: e[metric] }))
      .filter((d) => d.value != null);
  }, [entries, range, metric]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["week", "month", "year"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${range === r ? "bg-background shadow-soft" : "text-muted-foreground"}`}>
              {r}ly
            </button>
          ))}
        </div>
        <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
          {Object.entries(METRIC_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No {METRIC_LABEL[metric].toLowerCase()} data in this range yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name={METRIC_LABEL[metric]} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
