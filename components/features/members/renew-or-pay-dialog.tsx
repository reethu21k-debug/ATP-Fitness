"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { renewMembership, recordPayment } from "@/lib/actions/payment.actions";
import { RefreshCw, Wallet, Plus, Trash2 } from "lucide-react";
import type { PaymentMethod } from "@/types/database";

interface PlanOption { id: string; name: string; duration_days: number; price: number }
interface TrainerOption { id: string; full_name: string }

interface FormValues {
  planId: string;
  startDate: string;
  amount: number;
  discountAmount: number;
  trainerId: string;
  gstRate: number;
  method: PaymentMethod;
  transactionReference: string;
  splits: { method: Exclude<PaymentMethod, "split">; amount: number }[];
}

export function RenewOrPayDialog({
  memberId,
  currentMembershipId,
  plans,
  trainers,
}: {
  memberId: string;
  currentMembershipId: string | null;
  plans: PlanOption[];
  trainers: TrainerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"renew" | "pay">("renew");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, watch, control, setValue, formState } = useForm<FormValues>({
    defaultValues: {
      startDate: format(new Date(), "yyyy-MM-dd"),
      discountAmount: 0,
      gstRate: 0,
      method: "cash",
      splits: [{ method: "cash", amount: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "splits" });

  const method = watch("method");
  const planId = watch("planId");
  const selectedPlan = plans.find((p) => p.id === planId);

  function onSubmit(values: FormValues) {
    setError(null);
    startTransition(async () => {
      if (mode === "renew") {
        const result = await renewMembership({
          memberId,
          planId: values.planId,
          startDate: values.startDate,
          amount: Number(values.amount),
          discountAmount: Number(values.discountAmount),
          trainerId: values.trainerId || null,
          payment:
            Number(values.amount) > 0
              ? {
                  amount: Number(values.amount) - Number(values.discountAmount || 0),
                  gstRate: Number(values.gstRate),
                  method: values.method,
                  transactionReference: values.transactionReference,
                  splits: values.method === "split" ? values.splits.map((s) => ({ ...s, amount: Number(s.amount) })) : undefined,
                }
              : undefined,
        });
        if (!result.success) return setError(result.error);
      } else {
        if (!currentMembershipId) return setError("No active membership to pay against.");
        const result = await recordPayment({
          memberId,
          membershipId: currentMembershipId,
          amount: Number(values.amount),
          gstRate: Number(values.gstRate),
          method: values.method,
          transactionReference: values.transactionReference,
          splits: values.method === "split" ? values.splits.map((s) => ({ ...s, amount: Number(s.amount) })) : undefined,
        });
        if (!result.success) return setError(result.error);
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <RefreshCw className="h-4 w-4" /> Renew / Pay
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew membership or record a payment</DialogTitle>
          <DialogDescription>Handles cash, UPI, card, bank, and split payments with GST.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button type="button" onClick={() => setMode("renew")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${mode === "renew" ? "bg-background shadow-soft" : "text-muted-foreground"}`}>
            <RefreshCw className="h-3.5 w-3.5" /> Renew membership
          </button>
          <button type="button" onClick={() => setMode("pay")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${mode === "pay" ? "bg-background shadow-soft" : "text-muted-foreground"}`}>
            <Wallet className="h-3.5 w-3.5" /> Record payment
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mode === "renew" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    {...register("planId", { required: true, onChange: (e) => {
                      const p = plans.find((pl) => pl.id === e.target.value);
                      if (p) setValue("amount", p.price);
                    }})}
                  >
                    <option value="">Select plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" {...register("startDate", { required: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Trainer</Label>
                  <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("trainerId")}>
                    <option value="">Unassigned</option>
                    {trainers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Discount (₹)</Label>
                  <Input type="number" step="0.01" {...register("discountAmount")} />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹){mode === "renew" && selectedPlan ? ` — plan: ₹${selectedPlan.price}` : ""}</Label>
              <Input type="number" step="0.01" {...register("amount", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>GST rate (%)</Label>
              <Input type="number" step="0.01" {...register("gstRate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("method")}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank transfer</option>
              <option value="split">Split payment</option>
            </Select>
          </div>

          {method !== "split" && (
            <div className="space-y-1.5">
              <Label>Transaction reference (optional)</Label>
              <Input {...register("transactionReference")} placeholder="UPI ref / auth code / UTR" />
            </div>
          )}

          {method === "split" && (
            <div className="space-y-2">
              <Label>Split breakdown</Label>
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2">
                  <Select className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm" {...register(`splits.${i}.method`)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank</option>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Amount" className="w-28" {...register(`splits.${i}.amount`)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ method: "cash", amount: 0 })}>
                <Plus className="h-3.5 w-3.5" /> Add split
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>{mode === "renew" ? "Renew membership" : "Record payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
