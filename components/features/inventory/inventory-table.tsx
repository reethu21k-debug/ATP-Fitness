"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Search,
  PackagePlus,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listInventory } from "@/lib/actions/inventory.actions";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import type { InventoryOverviewRow } from "@/types/database";

const CATEGORY_FILTERS = [
  { value: "all", label: "All categories" },
  { value: "equipment", label: "Equipment" },
  { value: "supplement", label: "Supplements" },
  { value: "accessory", label: "Accessories" },
  { value: "other", label: "Other" },
];

export function InventoryTable() {
  const [items, setItems] = useState<InventoryOverviewRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await listInventory({ search, category, lowStockOnly });
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, lowStockOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search inventory…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {CATEGORY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Low stock only
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No items found.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 capitalize">{item.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.is_low_stock
                          ? "flex items-center gap-1 text-destructive"
                          : ""
                      }
                    >
                      {item.is_low_stock && (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {item.quantity} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.expiry_date ? (
                      <span
                        className={
                          item.is_expiring_soon
                            ? "flex items-center gap-1 text-warning"
                            : ""
                        }
                      >
                        {item.is_expiring_soon && (
                          <CalendarClock className="h-3.5 w-3.5" />
                        )}
                        {format(new Date(item.expiry_date), "dd MMM yyyy")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{item.supplier ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        setAdjusting({ id: item.id, name: item.name })
                      }
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <PackagePlus className="h-3.5 w-3.5" /> Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adjusting && (
        <AdjustStockDialog
          itemId={adjusting.id}
          itemName={adjusting.name}
          open={!!adjusting}
          onOpenChange={(open) => {
            if (!open) {
              setAdjusting(null);
              load();
            }
          }}
        />
      )}
    </div>
  );
}
