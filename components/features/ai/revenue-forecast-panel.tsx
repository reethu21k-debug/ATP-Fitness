"use client";

import { useState, useTransition } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computeRevenueForecast } from "@/lib/actions/ai.actions";
import { TrendingUp, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface MonthData { month: string; revenue: number; isForecast: boolean }

export function RevenueForecastPanel({ initialMonths }: { initialMonths: MonthData[] }) {
  const [months, setMonths] = useState(initialMonths);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleForecast() {
    setError(null);
    startTransition(async () => {
      const result = await computeRevenueForecast();
      if (!result.success || !result.data) return setError(!result.success ? result.error : "No forecast data returned.");
      setMonths(result.data.months);
      setNarrative(result.data.narrative);
    });
  }

  const chartData = months.map((m) => ({ ...m, label: format(new Date(`${m.month}-01`), "MMM yy") }));

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Revenue forecast</h2>
            <p className="text-sm text-muted-foreground">Trend-projected revenue for the next 3 months.</p>
          </div>
          <Button size="sm" onClick={handleForecast} loading={isPending}>
            <Sparkles className="h-4 w-4" /> Run forecast
          </Button>
        </div>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No payment history yet to forecast from.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, _name, item) => [`₹${value}`, item.payload.isForecast ? "Projected" : "Actual"]}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isForecast ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {narrative && (
          <div className="mt-4 rounded-xl bg-primary/5 p-4 text-sm text-foreground">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" /> AI summary</p>
            {narrative}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
