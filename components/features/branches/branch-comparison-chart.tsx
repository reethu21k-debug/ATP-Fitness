"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { BranchComparisonRow } from "@/types/database";

export function BranchComparisonChart({ rows, loading }: { rows: BranchComparisonRow[]; loading: boolean }) {
  const chartData = rows.map((r) => ({
    name: r.gym_name,
    Revenue: r.revenue,
    Members: r.member_count,
    Attendance: r.attendance_count,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Revenue by branch (selected period)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No branches yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
