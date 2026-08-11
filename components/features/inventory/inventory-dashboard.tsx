import { Boxes, AlertTriangle, CalendarClock } from "lucide-react";
import { getInventoryStats } from "@/lib/actions/inventory.actions";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { AddInventoryItemDialog } from "@/components/features/inventory/add-item-dialog";
import { InventoryTable } from "@/components/features/inventory/inventory-table";

export async function InventoryDashboard() {
  const stats = await getInventoryStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Equipment, supplements, and accessories.</p>
        </div>
        <div className="sm:shrink-0">
          <AddInventoryItemDialog />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total items" value={stats.totalItems} icon={Boxes} />
        <StatCard label="Low stock" value={stats.lowStock} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Expiring within 30 days" value={stats.expiringSoon} icon={CalendarClock} tone="warning" />
      </div>

      <InventoryTable />
    </div>
  );
}
