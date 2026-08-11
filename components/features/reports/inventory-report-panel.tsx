"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  getInventoryReport,
  type DateRange,
} from "@/lib/actions/reports.actions";
import { DateRangePicker, type DateRangeValue } from "./date-range-picker";
import { ExportButtons } from "./export-buttons";
import type { InventoryReportRow } from "@/types/database";

const COLUMNS = [
  { key: "item_name", label: "Item" },
  { key: "category", label: "Category" },
  { key: "quantity", label: "Qty on hand" },
  { key: "stock_value", label: "Stock value (₹)" },
  { key: "units_sold_in_range", label: "Units sold" },
];

export function InventoryReportPanel({
  range,
  onRangeChange,
}: {
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
}) {
  const [rows, setRows] = useState<InventoryReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getInventoryReport(range as DateRange).then((res) => {
      setRows(res.success ? (res.data ?? []) : []);
      setLoading(false);
    });
  }, [range]);

  const totalValue = rows.reduce((s, r) => s + Number(r.stock_value), 0);
  const lowStockCount = rows.filter((r) => r.is_low_stock).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={range} onChange={onRangeChange} />
        <ExportButtons
          title="Inventory Report"
          columns={COLUMNS}
          rows={rows as unknown as Record<string, unknown>[]}
          filename="inventory-report"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total stock value</p>
          <p className="text-xl font-semibold">
            ₹{totalValue.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Low-stock items</p>
          <p className="text-xl font-semibold">{lowStockCount}</p>
        </div>
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
                <tr key={r.item_id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    <span className="flex items-center gap-1.5">
                      {r.is_low_stock && (
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      )}
                      {r.item_name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 capitalize">{r.category}</td>
                  <td className="px-4 py-2.5">{r.quantity}</td>
                  <td className="px-4 py-2.5">
                    ₹{Number(r.stock_value).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">{r.units_sold_in_range}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No inventory items yet.
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
