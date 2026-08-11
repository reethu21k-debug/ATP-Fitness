"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createExpense, updateExpense } from "@/lib/actions/reports.actions";
import { Plus } from "lucide-react";
import type { Expense, ExpenseCategory } from "@/types/database";

interface FormValues {
  category: ExpenseCategory;
  description: string;
  amount: number;
  vendor: string;
  expenseDate: string;
  notes: string;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "salaries", label: "Salaries (off-payroll)" },
  { value: "equipment", label: "Equipment" },
  { value: "marketing", label: "Marketing" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

export function ExpenseDialog({ existing, onSaved }: { existing?: Expense; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: existing
      ? {
          category: existing.category,
          description: existing.description,
          amount: existing.amount,
          vendor: existing.vendor ?? "",
          expenseDate: existing.expense_date,
          notes: existing.notes ?? "",
        }
      : { category: "other", expenseDate: new Date().toISOString().slice(0, 10) },
  });

  function onSubmit(values: FormValues) {
    setError(null);
    const input = {
      category: values.category,
      description: values.description,
      amount: Number(values.amount),
      vendor: values.vendor || undefined,
      expenseDate: values.expenseDate,
      notes: values.notes || undefined,
    };
    startTransition(async () => {
      const result = existing ? await updateExpense(existing.id, input) : await createExpense(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button size="sm" variant="outline">Edit</Button>
        ) : (
          <Button size="sm"><Plus className="h-4 w-4" /> Add expense</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit expense" : "New expense"}</DialogTitle>
          <DialogDescription>Manual expenses roll up into the Profit &amp; Loss report.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("category")}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" {...register("amount", { required: true })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description</Label>
              <Input {...register("description", { required: true })} placeholder="e.g. Monthly electricity bill" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor (optional)</Label>
              <Input {...register("vendor")} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register("expenseDate", { required: true })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes (optional)</Label>
              <Input {...register("notes")} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>{existing ? "Save changes" : "Add expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
