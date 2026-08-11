"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createBranch, updateBranch, listTenantStaffForPicker } from "@/lib/actions/branches.actions";
import type { BranchFormInput } from "@/lib/validations/branches";
import type { Gym } from "@/types/database";

export function BranchDialog({ existing, onSaved }: { existing?: Gym; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [staff, setStaff] = useState<{ id: string; full_name: string; role: string }[]>([]);

  const { register, handleSubmit, reset } = useForm<BranchFormInput>({
    defaultValues: existing
      ? {
          name: existing.name,
          code: existing.code,
          address: existing.address ?? "",
          city: existing.city ?? "",
          state: existing.state ?? "",
          country: existing.country ?? "India",
          postalCode: existing.postal_code ?? "",
          phone: existing.phone ?? "",
          email: existing.email ?? "",
          timezone: existing.timezone ?? "Asia/Kolkata",
          gpsCheckinRadiusMeters: existing.gps_checkin_radius_meters,
          managerId: existing.manager_id ?? "",
          monthlyRevenueTarget: existing.monthly_revenue_target ?? undefined,
        }
      : { country: "India", timezone: "Asia/Kolkata", gpsCheckinRadiusMeters: 200 },
  });

  useEffect(() => {
    if (open) listTenantStaffForPicker().then(setStaff);
  }, [open]);

  function onSubmit(values: BranchFormInput) {
    setError(null);
    startTransition(async () => {
      const result = existing ? await updateBranch(existing.id, values) : await createBranch(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" /> Add Branch
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit branch" : "Add a new branch"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Update this branch's details."
              : "Each branch has its own members, staff, attendance, and revenue — combined analytics roll them up automatically."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Branch name</Label>
              <Input id="name" {...register("name", { required: true })} placeholder="Downtown" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" {...register("code", { required: true })} placeholder="DOWNTOWN" className="uppercase" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} placeholder="123 Main St" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register("state")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register("postalCode")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gpsCheckinRadiusMeters">GPS check-in radius (m)</Label>
              <Input id="gpsCheckinRadiusMeters" type="number" {...register("gpsCheckinRadiusMeters")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthlyRevenueTarget">Monthly revenue target</Label>
              <Input id="monthlyRevenueTarget" type="number" step="0.01" {...register("monthlyRevenueTarget")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="managerId">Branch manager (optional)</Label>
            <Select
              id="managerId"
              {...register("managerId")}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">No manager assigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.role})
                </option>
              ))}
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : existing ? "Save changes" : "Create branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
