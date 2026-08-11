"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PhotoUpload } from "@/components/features/members/photo-upload";
import { createStaffMember } from "@/lib/actions/staff.actions";
import type { StaffFormInput } from "@/lib/validations/staff";

export function StaffDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset } = useForm<StaffFormInput>({
    defaultValues: { role: "trainer" },
  });

  function onSubmit(values: StaffFormInput) {
    setError(null);
    startTransition(async () => {
      const result = await createStaffMember({ ...values, photoUrl });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      setPhotoUrl(null);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a trainer or receptionist</DialogTitle>
          <DialogDescription>
            An account is created automatically for this branch, with a temporary password sent by email and WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex justify-center">
            <PhotoUpload folder="trainers/photos" publicIdPrefix="staff" value={photoUrl} onChange={setPhotoUrl} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              {...register("role", { required: true })}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="trainer">Trainer</option>
              <option value="receptionist">Receptionist</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...register("fullName", { required: true })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email", { required: true })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone", { required: true })} placeholder="+91…" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
