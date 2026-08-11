"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createPlatformInvoice } from "@/lib/actions/platform.actions";
import type { SubscriptionPlan, TenantOverviewRow } from "@/types/database";

interface FormValues {
  tenantId: string;
  planCode: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amount: number;
  dueAt: string;
  notes: string;
}

export function InvoiceDialog({
  tenants, plans, onSaved,
}: { tenants: TenantOverviewRow[]; plans: SubscriptionPlan[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { billingPeriodStart: new Date().toISOString().slice(0, 10) },
  });

  function onSubmit(values: FormValues) {
    setError(null);
    startTransition(async () => {
      const result = await createPlatformInvoice({
        tenantId: values.tenantId,
        planCode: values.planCode,
        billingPeriodStart: values.billingPeriodStart,
        billingPeriodEnd: values.billingPeriodEnd,
        amount: Number(values.amount),
        currency: "INR",
        dueAt: values.dueAt || undefined,
        notes: values.notes || undefined,
      });
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New invoice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New platform invoice</DialogTitle>
          <DialogDescription>Record a SaaS billing invoice issued to a tenant.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Tenant</Label>
              <Select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                {...register("tenantId", { required: true })}
              >
                <option value="">Select a tenant…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Plan</Label>
              <Select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                {...register("planCode")}
              >
                <option value="">No specific plan</option>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing period start</Label>
              <Input type="date" {...register("billingPeriodStart", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Billing period end</Label>
              <Input type="date" {...register("billingPeriodEnd", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" {...register("amount", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date (optional)</Label>
              <Input type="date" {...register("dueAt")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes (optional)</Label>
              <Input {...register("notes")} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Create invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
