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
import { createWorkoutPlan, type CreateWorkoutPlanInput } from "@/lib/actions/trainer.actions";
import { generateWorkoutPlanAI } from "@/lib/actions/ai.actions";
import { Plus, Trash2, Dumbbell, Sparkles, Loader2 } from "lucide-react";
import type { PlanFrequency } from "@/types/database";

interface FormValues {
  title: string;
  frequency: PlanFrequency;
  startDate: string;
  endDate: string;
  notes: string;
  days: {
    dayLabel: string;
    exercises: { exerciseName: string; sets: string; reps: string; weightKg: string; videoUrl: string; notes: string }[];
  }[];
}

interface AiFormValues {
  goal: string;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  equipment: string;
  injuries: string;
}

export function WorkoutPlanDialog({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, control, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: {
      frequency: "weekly",
      startDate: format(new Date(), "yyyy-MM-dd"),
      days: [{ dayLabel: "Monday", exercises: [{ exerciseName: "", sets: "3", reps: "10", weightKg: "", videoUrl: "", notes: "" }] }],
    },
  });
  const { fields: dayFields, append: appendDay, remove: removeDay, replace: replaceDays } = useFieldArray({ control, name: "days" });

  const [showAiForm, setShowAiForm] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiForm = useForm<AiFormValues>({ defaultValues: { experienceLevel: "beginner", daysPerWeek: 3, goal: "general fitness", equipment: "full gym" } });

  function onGenerateWithAi(values: AiFormValues) {
    setAiError(null);
    setAiPending(true);
    startTransition(async () => {
      const result = await generateWorkoutPlanAI({
        goal: values.goal,
        experienceLevel: values.experienceLevel,
        daysPerWeek: Number(values.daysPerWeek),
        equipment: values.equipment,
        injuries: values.injuries || undefined,
      });
      setAiPending(false);
      if (!result.success || !result.data) return setAiError(!result.success ? result.error : "No plan returned.");
      const plan = result.data;

      setValue("title", plan.title);
      replaceDays(
        plan.days.map((d) => ({
          dayLabel: d.dayLabel,
          exercises: d.exercises.map((ex) => ({
            exerciseName: ex.exerciseName,
            sets: String(ex.sets),
            reps: ex.reps,
            weightKg: "",
            videoUrl: "",
            notes: ex.notes ?? "",
          })),
        }))
      );
      setShowAiForm(false);
    });
  }

  function onSubmit(values: FormValues) {
    setError(null);
    const input: CreateWorkoutPlanInput = {
      memberId,
      title: values.title,
      frequency: values.frequency,
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      notes: values.notes || undefined,
      days: values.days.map((d) => ({
        dayLabel: d.dayLabel,
        exercises: d.exercises
          .filter((e) => e.exerciseName.trim())
          .map((e) => ({
            exerciseName: e.exerciseName,
            sets: e.sets ? Number(e.sets) : undefined,
            reps: e.reps || undefined,
            weightKg: e.weightKg ? Number(e.weightKg) : undefined,
            videoUrl: e.videoUrl || undefined,
            notes: e.notes || undefined,
          })),
      })),
    };

    startTransition(async () => {
      const result = await createWorkoutPlan(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New workout plan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Dumbbell className="h-4 w-4" /> New workout plan</DialogTitle>
          <DialogDescription>Add days and exercises — sets, reps, weight, and an optional video link.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <button type="button" onClick={() => setShowAiForm((v) => !v)} className="flex w-full items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" /> Generate with AI
            </button>
            {showAiForm && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Goal (e.g. fat loss)" className="h-8 text-xs" {...aiForm.register("goal")} />
                  <Select className="h-8 rounded-lg border border-input bg-background px-2 text-xs" {...aiForm.register("experienceLevel")}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </Select>
                  <Input type="number" placeholder="Days/week" className="h-8 text-xs" {...aiForm.register("daysPerWeek")} />
                  <Input placeholder="Equipment" className="h-8 text-xs" {...aiForm.register("equipment")} />
                  <Input placeholder="Injuries (optional)" className="col-span-2 h-8 text-xs" {...aiForm.register("injuries")} />
                </div>
                <Button type="button" size="sm" onClick={aiForm.handleSubmit(onGenerateWithAi)} disabled={aiPending}>
                  {aiPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate plan
                </Button>
                {aiError && <p className="text-xs text-destructive">{aiError}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Plan title</Label>
              <Input {...register("title", { required: true })} placeholder="Strength Foundations — Phase 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...register("frequency")}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" {...register("startDate", { required: true })} />
            </div>
          </div>

          <div className="space-y-4">
            {dayFields.map((day, dayIndex) => (
              <DayFieldset key={day.id} control={control} dayIndex={dayIndex} register={register} onRemoveDay={() => removeDay(dayIndex)} />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendDay({ dayLabel: `Day ${dayFields.length + 1}`, exercises: [{ exerciseName: "", sets: "3", reps: "10", weightKg: "", videoUrl: "", notes: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add day
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>Save plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayFieldset({ control, dayIndex, register, onRemoveDay }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: `days.${dayIndex}.exercises` });

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Input {...register(`days.${dayIndex}.dayLabel`)} className="h-8 max-w-[160px] text-sm font-medium" />
        <Button type="button" variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={onRemoveDay}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2">
        {fields.map((ex: any, exIndex: number) => (
          <div key={ex.id} className="grid grid-cols-12 gap-1.5">
            <Input placeholder="Exercise" className="col-span-4 h-8 text-xs" {...register(`days.${dayIndex}.exercises.${exIndex}.exerciseName`)} />
            <Input placeholder="Sets" className="col-span-1 h-8 text-xs" {...register(`days.${dayIndex}.exercises.${exIndex}.sets`)} />
            <Input placeholder="Reps" className="col-span-2 h-8 text-xs" {...register(`days.${dayIndex}.exercises.${exIndex}.reps`)} />
            <Input placeholder="Weight kg" className="col-span-2 h-8 text-xs" {...register(`days.${dayIndex}.exercises.${exIndex}.weightKg`)} />
            <Input placeholder="Video URL" className="col-span-2 h-8 text-xs" {...register(`days.${dayIndex}.exercises.${exIndex}.videoUrl`)} />
            <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => remove(exIndex)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => append({ exerciseName: "", sets: "3", reps: "10", weightKg: "", videoUrl: "", notes: "" })}>
          <Plus className="h-3 w-3" /> Add exercise
        </Button>
      </div>
    </div>
  );
}
