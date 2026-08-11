"use client";

import { useEffect, useState } from "react";
import { getMembershipSummary } from "@/lib/actions/reports.actions";
import { ExportButtons } from "./export-buttons";
import type { MembershipSummaryRow } from "@/types/database";

const COLUMNS = [
  { key: "plan_name", label: "Plan" },
  { key: "active_count", label: "Active" },
  { key: "expired_count", label: "Expired" },
  { key: "total_revenue", label: "Revenue (₹)" },
];

export function MembershipPanel() {
  const [rows, setRows] = useState<MembershipSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMembershipSummary().then((res) => {
      setRows(res.success ? (res.data ?? []) : []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Active vs. expired members and revenue, by plan.
        </p>
        <ExportButtons
          title="Membership Report"
          columns={COLUMNS}
          rows={rows as unknown as Record<string, unknown>[]}
          filename="membership-report"
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
                <tr key={r.plan_name} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.plan_name}</td>
                  <td className="px-4 py-2.5">{r.active_count}</td>
                  <td className="px-4 py-2.5">{r.expired_count}</td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.total_revenue).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No membership data yet.
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
