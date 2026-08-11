"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDietPlan, type CreateDietPlanInput } from "@/lib/actions/trainer.actions";
import { generateDietPlanAI } from "@/lib/actions/ai.actions";
import { Plus, Trash2, Salad, Sparkles, Loader2 } from "lucide-react";
import type { MealType } from "@/types/database";

interface FormValues {
  title: string;
  startDate: string;
  dailyCalorieTarget: string;
  dailyProteinG: string;
  dailyCarbsG: string;
  dailyFatG: string;
  meals: { mealType: MealType; items: string; calories: string; proteinG: string; carbsG: string; fatG: string }[];
}

interface AiFormValues {
  goal: string;
  dailyCalorieTarget: number;
  dietaryPreference: string;
  mealsPerDay: number;
}

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

export function DietPlanDialog({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, control, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: {
      startDate: format(new Date(), "yyyy-MM-dd"),
      meals: MEAL_TYPES.map((mealType) => ({ mealType, items: "", calories: "", proteinG: "", carbsG: "", fatG: "" })),
    },
  });
  const { fields, replace: replaceMeals } = useFieldArray({ control, name: "meals" });

  const [showAiForm, setShowAiForm] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiForm = useForm<AiFormValues>({ defaultValues: { goal: "fat loss", dailyCalorieTarget: 2000, dietaryPreference: "no restrictions", mealsPerDay: 4 } });

  function onGenerateWithAi(values: AiFormValues) {
    setAiError(null);
    setAiPending(true);
    startTransition(async () => {
      const result = await generateDietPlanAI({
        goal: values.goal,
        dailyCalorieTarget: Number(values.dailyCalorieTarget),
        dietaryPreference: values.dietaryPreference,
        mealsPerDay: Number(values.mealsPerDay),
      });
      setAiPending(false);
      if (!result.success || !result.data) return setAiError(!result.success ? result.error : "No plan returned.");
      const plan = result.data;

      setValue("title", plan.title);
      setValue("dailyCalorieTarget", String(values.dailyCalorieTarget));
      setValue("dailyProteinG", String(plan.dailyProteinG));
      setValue("dailyCarbsG", String(plan.dailyCarbsG));
      setValue("dailyFatG", String(plan.dailyFatG));
      replaceMeals(
        MEAL_TYPES.map((mealType) => {
          const found = plan.meals.find((m) => m.mealType === mealType);
          return found
            ? { mealType, items: found.items, calories: String(found.calories), proteinG: String(found.proteinG), carbsG: String(found.carbsG), fatG: String(found.fatG) }
            : { mealType, items: "", calories: "", proteinG: "", carbsG: "", fatG: "" };
        })
      );
      setShowAiForm(false);
    });
  }

  function onSubmit(values: FormValues) {
    setError(null);
    const input: CreateDietPlanInput = {
      memberId,
      title: values.title,
      startDate: values.startDate,
      dailyCalorieTarget: values.dailyCalorieTarget ? Number(values.dailyCalorieTarget) : undefined,
      dailyProteinG: values.dailyProteinG ? Number(values.dailyProteinG) : undefined,
      dailyCarbsG: values.dailyCarbsG ? Number(values.dailyCarbsG) : undefined,
      dailyFatG: values.dailyFatG ? Number(values.dailyFatG) : undefined,
      meals: values.meals
        .filter((m) => m.items.trim())
        .map((m) => ({
          mealType: m.mealType,
          items: m.items,
          calories: m.calories ? Number(m.calories) : undefined,
          proteinG: m.proteinG ? Number(m.proteinG) : undefined,
          carbsG: m.carbsG ? Number(m.carbsG) : undefined,
          fatG: m.fatG ? Number(m.fatG) : undefined,
        })),
    };

    startTransition(async () => {
      const result = await createDietPlan(input);
      if (!result.success) return setError(result.error);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> New diet plan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Salad className="h-4 w-4" /> New diet plan</DialogTitle>
          <DialogDescription>Set daily macro targets and meals for breakfast, lunch, dinner, and snacks.</DialogDescription>
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
                  <Input type="number" placeholder="Daily calories" className="h-8 text-xs" {...aiForm.register("dailyCalorieTarget")} />
                  <Input placeholder="Dietary preference" className="h-8 text-xs" {...aiForm.register("dietaryPreference")} />
                  <Input type="number" placeholder="Meals/day" className="h-8 text-xs" {...aiForm.register("mealsPerDay")} />
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
              <Input {...register("title", { required: true })} placeholder="Cutting Phase — 2200 kcal" />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" {...register("startDate", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Daily calories</Label>
              <Input type="number" {...register("dailyCalorieTarget")} placeholder="2200" />
            </div>
            <div className="space-y-1.5">
              <Label>Protein (g)</Label>
              <Input type="number" {...register("dailyProteinG")} placeholder="160" />
            </div>
            <div className="space-y-1.5">
              <Label>Carbs (g)</Label>
              <Input type="number" {...register("dailyCarbsG")} placeholder="220" />
            </div>
            <div className="space-y-1.5">
              <Label>Fat (g)</Label>
              <Input type="number" {...register("dailyFatG")} placeholder="60" />
            </div>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={field.id} className="rounded-xl border p-4">
                <p className="mb-2 text-sm font-medium capitalize">{MEAL_TYPES[i]}</p>
                <Input placeholder="e.g. 2 eggs, 1 toast, 1 banana" className="mb-2" {...register(`meals.${i}.items`)} />
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <Input placeholder="kcal" className="h-8 text-xs" {...register(`meals.${i}.calories`)} />
                  <Input placeholder="Protein g" className="h-8 text-xs" {...register(`meals.${i}.proteinG`)} />
                  <Input placeholder="Carbs g" className="h-8 text-xs" {...register(`meals.${i}.carbsG`)} />
                  <Input placeholder="Fat g" className="h-8 text-xs" {...register(`meals.${i}.fatG`)} />
                </div>
              </div>
            ))}
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
