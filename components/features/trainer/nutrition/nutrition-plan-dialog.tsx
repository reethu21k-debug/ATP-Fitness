"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createNutritionPlan, type CreateNutritionPlanInput } from "@/lib/actions/nutrition.actions";
import { Plus, Salad } from "lucide-react";

interface FormValues {
  name: string;
  startDate: string;
  durationDays: string;
  calorieTarget: string;
  proteinTargetG: string;
  carbTargetG: string;
  fatTargetG: string;
  fiberTargetG: string;
  waterTargetMl: string;
  mealFrequency: string;
  notes: string;
}

export function NutritionPlanDialog({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { startDate: format(new Date(), "yyyy-MM-dd"), durationDays: "30" },
  });

  function onSubmit(values: FormValues) {
    setError(null);
    const input: CreateNutritionPlanInput = {
      memberId,
      name: values.name,
      startDate: values.startDate,
      durationDays: Number(values.durationDays) || 30,
      calorieTarget: values.calorieTarget ? Number(values.calorieTarget) : undefined,
      proteinTargetG: values.proteinTargetG ? Number(values.proteinTargetG) : undefined,
      carbTargetG: values.carbTargetG ? Number(values.carbTargetG) : undefined,
      fatTargetG: values.fatTargetG ? Number(values.fatTargetG) : undefined,
      fiberTargetG: values.fiberTargetG ? Number(values.fiberTargetG) : undefined,
      waterTargetMl: values.waterTargetMl ? Number(values.waterTargetMl) : undefined,
      mealFrequency: values.mealFrequency ? Number(values.mealFrequency) : undefined,
      notes: values.notes || undefined,
    };

    startTransition(async () => {
      const result = await createNutritionPlan(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New nutrition plan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Salad className="h-4 w-4" /> New nutrition plan</DialogTitle>
          <DialogDescription>Set daily targets — you&apos;ll add meals and foods next, with macros calculated automatically.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Plan name</Label>
              <Input {...register("name", { required: true })} placeholder="Cutting Phase — 2200 kcal" />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" {...register("startDate", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (days)</Label>
              <Input type="number" {...register("durationDays")} placeholder="30" />
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Daily targets</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Calories</Label>
                <Input type="number" className="h-8 text-xs" {...register("calorieTarget")} placeholder="2200" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Protein (g)</Label>
                <Input type="number" className="h-8 text-xs" {...register("proteinTargetG")} placeholder="150" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carbs (g)</Label>
                <Input type="number" className="h-8 text-xs" {...register("carbTargetG")} placeholder="250" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fat (g)</Label>
                <Input type="number" className="h-8 text-xs" {...register("fatTargetG")} placeholder="65" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fiber (g)</Label>
                <Input type="number" className="h-8 text-xs" {...register("fiberTargetG")} placeholder="30" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Water (ml)</Label>
                <Input type="number" className="h-8 text-xs" {...register("waterTargetMl")} placeholder="3000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meals/day</Label>
                <Input type="number" className="h-8 text-xs" {...register("mealFrequency")} placeholder="4" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input {...register("notes")} placeholder="Any guidance for the client" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Create plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
