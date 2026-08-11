"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  getProfitLossReport,
  type DateRange,
} from "@/lib/actions/reports.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import { ExportButtons } from "./export-buttons";
import type { ProfitLossRow } from "@/types/database";

const COLUMNS = [
  { key: "month", label: "Month" },
  { key: "revenue", label: "Revenue (₹)" },
  { key: "refunds", label: "Refunds (₹)" },
  { key: "manual_expenses", label: "Expenses (₹)" },
  { key: "payroll_expenses", label: "Payroll (₹)" },
  { key: "total_expenses", label: "Total expenses (₹)" },
  { key: "profit", label: "Profit (₹)" },
];

export function ProfitLossPanel({
  range,
  onRangeChange,
}: {
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
}) {
  const [rows, setRows] = useState<ProfitLossRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProfitLossReport(range as DateRange).then((res) => {
      setRows(res.success ? (res.data ?? []) : []);
      setLoading(false);
    });
  }, [range]);

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const totalExpenses = rows.reduce((s, r) => s + Number(r.total_expenses), 0);
  const totalProfit = rows.reduce((s, r) => s + Number(r.profit), 0);
  const chartData = rows.map((r) => ({
    ...r,
    label: format(new Date(r.month), "MMM yy"),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Use the range below to select a multi-month window — each row is one
          calendar month.
        </p>
        <DateRangePicker value={range} onChange={onRangeChange} />
      </div>
      <div className="flex justify-end">
        <ExportButtons
          title="Profit & Loss Report"
          columns={COLUMNS}
          rows={rows as unknown as Record<string, unknown>[]}
          filename="profit-loss-report"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total revenue</p>
          <p className="text-xl font-semibold">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total expenses</p>
          <p className="text-xl font-semibold">
            ₹{totalExpenses.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Net profit</p>
          <p
            className={`text-xl font-semibold ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}
          >
            ₹{totalProfit.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No data in this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="revenue"
                fill="hsl(var(--success))"
                radius={[4, 4, 0, 0]}
                name="Revenue"
              />
              <Bar
                dataKey="total_expenses"
                fill="hsl(var(--destructive))"
                radius={[4, 4, 0, 0]}
                name="Expenses"
              />
              <Bar
                dataKey="profit"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Profit"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {format(new Date(r.month), "MMMM yyyy")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.revenue).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.refunds).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.manual_expenses).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.payroll_expenses).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.total_expenses).toLocaleString("en-IN")}
                  </td>
                  <td
                    className={`px-4 py-2.5 font-medium ${Number(r.profit) >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    ₹{Number(r.profit).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No data in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
