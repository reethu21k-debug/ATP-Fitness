"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { upsertSubscriptionPlan } from "@/lib/actions/platform.actions";
import type { SubscriptionPlan } from "@/types/database";

interface FormValues {
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  maxGyms: string;
  maxMembers: string;
  maxStaff: string;
  features: string;
  isActive: boolean;
  sortOrder: number;
}

export function PlanDialog({ existing, onSaved }: { existing?: SubscriptionPlan; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: existing
      ? {
          code: existing.code,
          name: existing.name,
          description: existing.description ?? "",
          monthlyPrice: existing.monthly_price,
          annualPrice: existing.annual_price,
          maxGyms: existing.max_gyms?.toString() ?? "",
          maxMembers: existing.max_members?.toString() ?? "",
          maxStaff: existing.max_staff?.toString() ?? "",
          features: existing.features.join("\n"),
          isActive: existing.is_active,
          sortOrder: existing.sort_order,
        }
      : { isActive: true, sortOrder: 0 },
  });

  function onSubmit(values: FormValues) {
    setError(null);
    startTransition(async () => {
      const result = await upsertSubscriptionPlan({
        code: values.code,
        name: values.name,
        description: values.description,
        monthlyPrice: Number(values.monthlyPrice),
        annualPrice: Number(values.annualPrice),
        currency: "INR",
        maxGyms: values.maxGyms ? Number(values.maxGyms) : null,
        maxMembers: values.maxMembers ? Number(values.maxMembers) : null,
        maxStaff: values.maxStaff ? Number(values.maxStaff) : null,
        features: values.features,
        isActive: values.isActive,
        sortOrder: Number(values.sortOrder),
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
        {existing ? (
          <Button size="sm" variant="outline">
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" /> New plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit plan" : "New subscription plan"}</DialogTitle>
          <DialogDescription>
            This is the platform&apos;s own pricing tier — shown on the public pricing page and assignable to any
            tenant.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan code</Label>
              <Input {...register("code", { required: true })} placeholder="growth" disabled={!!existing} />
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input {...register("name", { required: true })} placeholder="Growth" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description</Label>
              <Input {...register("description")} placeholder="For growing gyms that need marketing and AI tools." />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly price (₹)</Label>
              <Input type="number" step="0.01" {...register("monthlyPrice", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Annual price (₹)</Label>
              <Input type="number" step="0.01" {...register("annualPrice", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max gyms (blank = unlimited)</Label>
              <Input type="number" {...register("maxGyms")} />
            </div>
            <div className="space-y-1.5">
              <Label>Max members</Label>
              <Input type="number" {...register("maxMembers")} />
            </div>
            <div className="space-y-1.5">
              <Label>Max staff</Label>
              <Input type="number" {...register("maxStaff")} />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" {...register("sortOrder")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Features (one per line)</Label>
              <textarea
                {...register("features")}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={"Up to 3 gym locations\nMarketing & CRM\nAI features"}
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border-input" />
              Active (visible on pricing page, assignable to tenants)
            </label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {existing ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
