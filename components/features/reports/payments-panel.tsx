"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  getPaymentsByMethodReport,
  type DateRange,
} from "@/lib/actions/reports.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import { ExportButtons } from "./export-buttons";
import type { PaymentsByMethodRow } from "@/types/database";

const COLUMNS = [
  { key: "method", label: "Method" },
  { key: "transaction_count", label: "Transactions" },
  { key: "total_amount", label: "Total (₹)" },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "#8b5cf6",
];

export function PaymentsPanel({
  range,
  onRangeChange,
}: {
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
}) {
  const [rows, setRows] = useState<PaymentsByMethodRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPaymentsByMethodReport(range as DateRange).then((res) => {
      setRows(res.success ? (res.data ?? []) : []);
      setLoading(false);
    });
  }, [range]);

  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={onRangeChange} />
        <ExportButtons
          title="Payments by Method"
          columns={COLUMNS}
          rows={rows as unknown as Record<string, unknown>[]}
          filename="payments-by-method"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payments in this range.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="total_amount"
                  nameKey="method"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {rows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                />
                <Legend />
              </PieChart>
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
                  <tr key={r.method} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium capitalize">
                      {r.method}
                    </td>
                    <td className="px-4 py-2.5">{r.transaction_count}</td>
                    <td className="px-4 py-2.5">
                      ₹{Number(r.total_amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="bg-secondary/20 font-medium">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5">
                      {rows.reduce(
                        (s, r) => s + Number(r.transaction_count),
                        0,
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      ₹{total.toLocaleString("en-IN")}
                    </td>
                  </tr>
                )}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={3}
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
    </div>
  );
}
