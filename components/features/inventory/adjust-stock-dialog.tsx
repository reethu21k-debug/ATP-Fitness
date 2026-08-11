"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { adjustStock } from "@/lib/actions/inventory.actions";
import type { InventoryTxnType } from "@/types/database";
import { PackagePlus } from "lucide-react";

export function AdjustStockDialog({ itemId, itemName, open, onOpenChange }: { itemId: string; itemName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [type, setType] = useState<InventoryTxnType>("restock");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    const qty = Number(quantity);
    if (!qty) return setError("Enter a quantity.");
    startTransition(async () => {
      const result = await adjustStock(itemId, type, qty, notes || undefined);
      if (!result.success) return setError(result.error);
      onOpenChange(false);
      setQuantity("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackagePlus className="h-4 w-4" /> Adjust stock — {itemName}</DialogTitle>
          <DialogDescription>Restock, record a sale, damage, or a manual correction.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as InventoryTxnType)}>
              <option value="restock">Restock (add)</option>
              <option value="sale">Sale (remove)</option>
              <option value="damage">Damage / loss (remove)</option>
              <option value="adjustment">Manual adjustment (+/-)</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{type === "adjustment" ? "Change (use negative for reduction)" : "Quantity"}</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
