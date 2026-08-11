"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  getRevenueReport,
  type DateRange,
} from "@/lib/actions/reports.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import { ExportButtons } from "./export-buttons";
import type { RevenueReportRow } from "@/types/database";

const COLUMNS = [
  { key: "day", label: "Date" },
  { key: "gross_amount", label: "Gross (₹)" },
  { key: "gst_amount", label: "GST (₹)" },
  { key: "refund_amount", label: "Refunds (₹)" },
  { key: "net_amount", label: "Net (₹)" },
  { key: "transaction_count", label: "Transactions" },
];

export function RevenuePanel({
  range,
  onRangeChange,
}: {
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
}) {
  const [rows, setRows] = useState<RevenueReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRevenueReport(range as DateRange).then((res) => {
      setRows(res.success ? (res.data ?? []) : []);
      setLoading(false);
    });
  }, [range]);

  const totalNet = rows.reduce((s, r) => s + Number(r.net_amount), 0);
  const totalTxns = rows.reduce((s, r) => s + Number(r.transaction_count), 0);
  const chartData = rows.map((r) => ({
    ...r,
    label: format(new Date(r.day), "d MMM"),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={onRangeChange} />
        <ExportButtons
          title="Revenue Report"
          columns={COLUMNS}
          rows={rows as unknown as Record<string, unknown>[]}
          filename="revenue-report"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Net revenue in range</p>
          <p className="text-xl font-semibold">
            ₹{totalNet.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-xl font-semibold">{totalTxns}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No revenue in this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
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
              />
              <Line
                type="monotone"
                dataKey="net_amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Net revenue"
              />
            </LineChart>
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
                <tr key={r.day} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    {format(new Date(r.day), "d MMM yyyy")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.gross_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.gst_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.refund_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    ₹{Number(r.net_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">{r.transaction_count}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
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
