"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function PeakHoursChart({ data }: { data: { hour: number; count: number }[] }) {
  const chartData = data.map((d) => ({
    hour: d.hour === 0 ? "12am" : d.hour < 12 ? `${d.hour}am` : d.hour === 12 ? "12pm" : `${d.hour - 12}pm`,
    visits: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
