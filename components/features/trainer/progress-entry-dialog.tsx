"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addProgressEntry, type AddProgressInput } from "@/lib/actions/trainer.actions";
import { Plus, Ruler } from "lucide-react";

interface FormValues {
  recordedAt: string;
  weightKg: string;
  bodyFatPct: string;
  chestCm: string;
  waistCm: string;
  hipsCm: string;
  armsCm: string;
  thighsCm: string;
  notes: string;
}

export function ProgressEntryDialog({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { recordedAt: format(new Date(), "yyyy-MM-dd") },
  });

  function onSubmit(values: FormValues) {
    setError(null);
    const input: AddProgressInput = {
      memberId,
      recordedAt: values.recordedAt,
      weightKg: values.weightKg ? Number(values.weightKg) : undefined,
      bodyFatPct: values.bodyFatPct ? Number(values.bodyFatPct) : undefined,
      chestCm: values.chestCm ? Number(values.chestCm) : undefined,
      waistCm: values.waistCm ? Number(values.waistCm) : undefined,
      hipsCm: values.hipsCm ? Number(values.hipsCm) : undefined,
      armsCm: values.armsCm ? Number(values.armsCm) : undefined,
      thighsCm: values.thighsCm ? Number(values.thighsCm) : undefined,
      notes: values.notes || undefined,
    };
    startTransition(async () => {
      const result = await addProgressEntry(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Log progress</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ruler className="h-4 w-4" /> Log progress</DialogTitle>
          <DialogDescription>Weight, body fat, and measurements for this date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" {...register("recordedAt", { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Weight (kg)</Label><Input type="number" step="0.1" {...register("weightKg")} /></div>
            <div className="space-y-1.5"><Label>Body fat (%)</Label><Input type="number" step="0.1" {...register("bodyFatPct")} /></div>
            <div className="space-y-1.5"><Label>Chest (cm)</Label><Input type="number" step="0.1" {...register("chestCm")} /></div>
            <div className="space-y-1.5"><Label>Waist (cm)</Label><Input type="number" step="0.1" {...register("waistCm")} /></div>
            <div className="space-y-1.5"><Label>Hips (cm)</Label><Input type="number" step="0.1" {...register("hipsCm")} /></div>
            <div className="space-y-1.5"><Label>Arms (cm)</Label><Input type="number" step="0.1" {...register("armsCm")} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Thighs (cm)</Label><Input type="number" step="0.1" {...register("thighsCm")} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register("notes")} placeholder="Optional" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Save entry</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
