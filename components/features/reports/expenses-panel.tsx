"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import {
  listExpenses,
  deleteExpense,
  type DateRange,
} from "@/lib/actions/reports.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import { ExportButtons } from "./export-buttons";
import { ExpenseDialog } from "./expense-dialog";
import type { Expense } from "@/types/database";

const COLUMNS = [
  { key: "expense_date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "vendor", label: "Vendor" },
  { key: "amount", label: "Amount (₹)" },
];

export function ExpensesPanel({
  range,
  onRangeChange,
}: {
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
}) {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await listExpenses({ range: range as DateRange });
    setRows(res.success ? (res.data ?? []) : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense record?")) return;
    setBusyId(id);
    await deleteExpense(id);
    await load();
    setBusyId(null);
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={onRangeChange} />
        <div className="flex items-center gap-2">
          <ExportButtons
            title="Expenses Report"
            columns={COLUMNS}
            rows={rows as unknown as Record<string, unknown>[]}
            filename="expenses-report"
          />
          <ExpenseDialog onSaved={load} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:w-64">
        <p className="text-xs text-muted-foreground">Total expenses in range</p>
        <p className="text-xl font-semibold">
          ₹{total.toLocaleString("en-IN")}
        </p>
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
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    {format(new Date(r.expense_date), "d MMM yyyy")}
                  </td>
                  <td className="px-4 py-2.5 capitalize">{r.category}</td>
                  <td className="px-4 py-2.5">{r.description}</td>
                  <td className="px-4 py-2.5">{r.vendor ?? "—"}</td>
                  <td className="px-4 py-2.5 font-medium">
                    ₹{Number(r.amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <ExpenseDialog existing={r} onSaved={load} />
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={busyId === r.id}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No expenses recorded in this range.
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
