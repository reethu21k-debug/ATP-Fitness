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
} from "recharts";
import {
  getAttendanceReport,
  type DateRange,
} from "@/lib/actions/reports.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import { ExportButtons } from "./export-buttons";
import type { AttendanceReportRow } from "@/types/database";

const COLUMNS = [
  { key: "day", label: "Date" },
  { key: "check_ins", label: "Check-ins" },
  { key: "unique_members", label: "Unique members" },
  { key: "avg_duration_minutes", label: "Avg. duration (min)" },
];

export function AttendancePanel({
  range,
  onRangeChange,
}: {
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
}) {
  const [rows, setRows] = useState<AttendanceReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAttendanceReport(range as DateRange).then((res) => {
      setRows(res.success ? (res.data ?? []) : []);
      setLoading(false);
    });
  }, [range]);

  const totalCheckIns = rows.reduce((s, r) => s + Number(r.check_ins), 0);
  const peakDay = rows.reduce(
    (max, r) => (Number(r.check_ins) > Number(max?.check_ins ?? -1) ? r : max),
    rows[0],
  );
  const chartData = rows.map((r) => ({
    ...r,
    label: format(new Date(r.day), "d MMM"),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={onRangeChange} />
        <ExportButtons
          title="Attendance Report"
          columns={COLUMNS}
          rows={rows as unknown as Record<string, unknown>[]}
          filename="attendance-report"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total check-ins</p>
          <p className="text-xl font-semibold">{totalCheckIns}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Peak day</p>
          <p className="text-xl font-semibold">
            {peakDay
              ? `${format(new Date(peakDay.day), "d MMM")} — ${peakDay.check_ins}`
              : "—"}
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
            No attendance in this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
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
              />
              <Bar
                dataKey="check_ins"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Check-ins"
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
                <tr key={r.day} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    {format(new Date(r.day), "d MMM yyyy")}
                  </td>
                  <td className="px-4 py-2.5">{r.check_ins}</td>
                  <td className="px-4 py-2.5">{r.unique_members}</td>
                  <td className="px-4 py-2.5">
                    {Number(r.avg_duration_minutes).toFixed(0)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
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
