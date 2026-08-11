"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createInventoryItem, type CreateInventoryItemInput } from "@/lib/actions/inventory.actions";
import { Plus } from "lucide-react";
import type { InventoryCategory } from "@/types/database";

interface FormValues {
  name: string;
  category: InventoryCategory;
  barcode: string;
  initialQuantity: number;
  unit: string;
  costPrice: number;
  sellPrice: number;
  lowStockThreshold: number;
  expiryDate: string;
  supplier: string;
}

export function AddInventoryItemDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { category: "equipment", unit: "piece", lowStockThreshold: 5, initialQuantity: 0 } });

  function onSubmit(values: FormValues) {
    setError(null);
    const input: CreateInventoryItemInput = {
      name: values.name,
      category: values.category,
      barcode: values.barcode || undefined,
      initialQuantity: Number(values.initialQuantity),
      unit: values.unit,
      costPrice: values.costPrice ? Number(values.costPrice) : undefined,
      sellPrice: values.sellPrice ? Number(values.sellPrice) : undefined,
      lowStockThreshold: Number(values.lowStockThreshold),
      expiryDate: values.expiryDate || undefined,
      supplier: values.supplier || undefined,
    };
    startTransition(async () => {
      const result = await createInventoryItem(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> Add item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add inventory item</DialogTitle>
          <DialogDescription>Equipment, supplements, or accessories.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2"><Label>Name</Label><Input {...register("name", { required: true })} /></div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("category")}>
                <option value="equipment">Equipment</option>
                <option value="supplement">Supplement</option>
                <option value="accessory">Accessory</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Barcode (optional)</Label><Input {...register("barcode")} /></div>
            <div className="space-y-1.5"><Label>Initial quantity</Label><Input type="number" {...register("initialQuantity")} /></div>
            <div className="space-y-1.5"><Label>Unit</Label><Input {...register("unit")} placeholder="piece, bottle, kg…" /></div>
            <div className="space-y-1.5"><Label>Cost price (₹)</Label><Input type="number" step="0.01" {...register("costPrice")} /></div>
            <div className="space-y-1.5"><Label>Sell price (₹)</Label><Input type="number" step="0.01" {...register("sellPrice")} /></div>
            <div className="space-y-1.5"><Label>Low stock threshold</Label><Input type="number" {...register("lowStockThreshold")} /></div>
            <div className="space-y-1.5"><Label>Expiry date (optional)</Label><Input type="date" {...register("expiryDate")} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Supplier (optional)</Label><Input {...register("supplier")} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Add item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
