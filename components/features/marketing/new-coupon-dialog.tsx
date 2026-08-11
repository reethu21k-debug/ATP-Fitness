"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createCoupon, type CreateCouponInput } from "@/lib/actions/marketing.actions";
import { Plus } from "lucide-react";
import type { CouponDiscountType } from "@/types/database";

interface FormValues {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number;
  minPurchaseAmount: number;
  usageLimit: number;
  usageLimitPerMember: number;
  validUntil: string;
}

export function NewCouponDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: { discountType: "percentage", usageLimitPerMember: 1, minPurchaseAmount: 0 },
  });

  const discountType = watch("discountType");

  function onSubmit(values: FormValues) {
    setError(null);
    const input: CreateCouponInput = {
      code: values.code,
      description: values.description || undefined,
      discountType: values.discountType,
      discountValue: Number(values.discountValue),
      maxDiscountAmount: values.maxDiscountAmount ? Number(values.maxDiscountAmount) : undefined,
      minPurchaseAmount: values.minPurchaseAmount ? Number(values.minPurchaseAmount) : 0,
      usageLimit: values.usageLimit ? Number(values.usageLimit) : undefined,
      usageLimitPerMember: values.usageLimitPerMember ? Number(values.usageLimitPerMember) : 1,
      validUntil: values.validUntil ? new Date(values.validUntil).toISOString() : undefined,
    };
    startTransition(async () => {
      const result = await createCoupon(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New coupon</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New coupon</DialogTitle>
          <DialogDescription>Create a discount code members can redeem at checkout.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Code</Label>
              <Input {...register("code", { required: true })} placeholder="e.g. SUMMER25" className="uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label>Discount type</Label>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("discountType")}>
                <option value="percentage">Percentage</option>
                <option value="flat">Flat amount (₹)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{discountType === "percentage" ? "Discount %" : "Discount ₹"}</Label>
              <Input type="number" step="0.01" {...register("discountValue", { required: true })} />
            </div>
            {discountType === "percentage" && (
              <div className="space-y-1.5">
                <Label>Max discount ₹ (optional)</Label>
                <Input type="number" step="0.01" {...register("maxDiscountAmount")} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Min purchase ₹</Label>
              <Input type="number" step="0.01" {...register("minPurchaseAmount")} />
            </div>
            <div className="space-y-1.5">
              <Label>Total usage limit (optional)</Label>
              <Input type="number" {...register("usageLimit")} placeholder="Unlimited" />
            </div>
            <div className="space-y-1.5">
              <Label>Uses per member</Label>
              <Input type="number" {...register("usageLimitPerMember")} />
            </div>
            <div className="space-y-1.5">
              <Label>Valid until (optional)</Label>
              <Input type="date" {...register("validUntil")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description (optional)</Label>
              <Input {...register("description")} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Create coupon</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
