"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMembershipPlan, updateMembershipPlan, type MembershipPlanRow } from "@/lib/actions/plans.actions";
import type { MembershipPlanFormInput } from "@/lib/validations/membership-plan";

export function PlanDialog({
  plan,
  onSaved,
  trigger,
}: {
  /** Pass an existing plan to edit it; omit to create a new one. */
  plan?: MembershipPlanRow;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(plan);

  const { register, handleSubmit, reset } = useForm<MembershipPlanFormInput>({
    defaultValues: {
      name: plan?.name ?? "",
      durationDays: plan?.duration_days ?? 30,
      price: plan?.price ?? 0,
      description: plan?.description ?? "",
    },
  });

  // Re-seed the form each time the dialog opens for a given plan, since the
  // same PlanDialog instance re-renders with fresh `plan` props from the list.
  useEffect(() => {
    if (open) {
      reset({
        name: plan?.name ?? "",
        durationDays: plan?.duration_days ?? 30,
        price: plan?.price ?? 0,
        description: plan?.description ?? "",
      });
    }
  }, [open, plan, reset]);

  function onSubmit(values: MembershipPlanFormInput) {
    setError(null);
    startTransition(async () => {
      const result = isEditing
        ? await updateMembershipPlan(plan!.id, values)
        : await createMembershipPlan(values);

      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit plan" : "New membership plan"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Changes apply to new signups and renewals only — members already on this plan keep the amount and end date they were already given."
              : "Members and staff will be able to select this plan when adding or renewing a member."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Plan name</Label>
            <Input id="name" placeholder="e.g. Gold — 3 Months" {...register("name", { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="durationDays">Duration (days)</Label>
              <Input id="durationDays" type="number" min={1} {...register("durationDays", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (₹)</Label>
              <Input id="price" type="number" min={0} step="0.01" {...register("price", { required: true })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving…" : isEditing ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}