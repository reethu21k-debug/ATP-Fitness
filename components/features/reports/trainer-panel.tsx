"use client";

import { useEffect, useState } from "react";
import {
  getTrainerPerformanceReport,
  type DateRange,
} from "@/lib/actions/reports.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import { ExportButtons } from "./export-buttons";
import type { TrainerPerformanceRow } from "@/types/database";

const COLUMNS = [
  { key: "trainer_name", label: "Trainer" },
  { key: "active_clients", label: "Active clients" },
  { key: "revenue_generated", label: "Revenue (₹)" },
  { key: "workout_plans_created", label: "Workout plans" },
  { key: "diet_plans_created", label: "Diet plans" },
  { key: "avg_client_checkins", label: "Avg. client check-ins" },
];

export function TrainerPanel({
  range,
  onRangeChange,
}: {
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
}) {
  const [rows, setRows] = useState<TrainerPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTrainerPerformanceReport(range as DateRange).then((res) => {
      setRows(res.success ? (res.data ?? []) : []);
      setLoading(false);
    });
  }, [range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={onRangeChange} />
        <ExportButtons
          title="Trainer Performance Report"
          columns={COLUMNS}
          rows={rows as unknown as Record<string, unknown>[]}
          filename="trainer-performance-report"
        />
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
                <tr key={r.trainer_id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.trainer_name}</td>
                  <td className="px-4 py-2.5">{r.active_clients}</td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.revenue_generated).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">{r.workout_plans_created}</td>
                  <td className="px-4 py-2.5">{r.diet_plans_created}</td>
                  <td className="px-4 py-2.5">
                    {Number(r.avg_client_checkins).toFixed(1)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No trainers found.
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
