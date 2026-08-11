"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MealCard } from "./meal-card";
import { NutritionSummary } from "./nutrition-summary";
import {
  addMeal, deactivateNutritionPlan, deleteNutritionPlan, duplicateNutritionPlan, updateNutritionTargets,
  type NutritionPlanWithDetails,
} from "@/lib/actions/nutrition.actions";
import { ZERO_NUTRITION, sumNutrition } from "@/lib/services/nutrition";
import type { NutritionValues } from "@/types/database";
import { Plus, Settings2, Copy, Trash2, PauseCircle, ChevronDown, ChevronUp } from "lucide-react";

export function NutritionPlanEditor({ plan, memberId }: { plan: NutritionPlanWithDetails; memberId: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [mealTotals, setMealTotals] = useState<Record<string, NutritionValues>>({});
  const [editingTargets, setEditingTargets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newMealName, setNewMealName] = useState("");

  const daily = useMemo(
    () => Object.values(mealTotals).reduce<NutritionValues>((acc, v) => sumNutrition(acc, v), ZERO_NUTRITION),
    [mealTotals]
  );

  function handleMealTotals(mealId: string, totals: NutritionValues) {
    setMealTotals((prev) => ({ ...prev, [mealId]: totals }));
  }

  async function onAddMeal() {
    setBusy(true);
    await addMeal(plan.id, memberId, newMealName.trim() || `Meal ${plan.meals.length + 1}`);
    setNewMealName("");
    setBusy(false);
    router.refresh();
  }

  async function onDuplicate() {
    setBusy(true);
    await duplicateNutritionPlan(plan.id, memberId);
    setBusy(false);
    router.refresh();
  }

  async function onDeactivate() {
    setBusy(true);
    await deactivateNutritionPlan(plan.id, memberId);
    setBusy(false);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm(`Delete "${plan.name}"? This can't be undone.`)) return;
    setBusy(true);
    await deleteNutritionPlan(plan.id, memberId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div>
          <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1.5 font-semibold">
            {plan.name} {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <p className="text-xs text-muted-foreground">
            From {format(new Date(plan.start_date), "dd MMM yyyy")} · {plan.duration_days} days
            {!plan.is_active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5">Inactive</span>}
            {plan.version > 1 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-primary">v{plan.version}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTargets((v) => !v)} title="Edit targets">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} disabled={busy} title="Duplicate plan">
            <Copy className="h-4 w-4" />
          </Button>
          {plan.is_active && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDeactivate} disabled={busy} title="Deactivate plan">
              <PauseCircle className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} disabled={busy} title="Delete plan">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-5 p-4">
          {editingTargets ? (
            <TargetsForm plan={plan} memberId={memberId} onDone={() => setEditingTargets(false)} />
          ) : (
            <NutritionSummary
              targets={{
                calorieTarget: plan.calorie_target,
                proteinTargetG: plan.protein_target_g,
                carbTargetG: plan.carb_target_g,
                fatTargetG: plan.fat_target_g,
              }}
              planned={daily}
            />
          )}

          <div className="space-y-3">
            {plan.meals.map((meal, i) => (
              <MealCard
                key={meal.id}
                meal={meal}
                memberId={memberId}
                planId={plan.id}
                isFirst={i === 0}
                isLast={i === plan.meals.length - 1}
                onTotalsChange={handleMealTotals}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="New meal name (e.g. Pre-Workout)"
              value={newMealName}
              onChange={(e) => setNewMealName(e.target.value)}
              className="h-8 max-w-xs text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={onAddMeal} disabled={busy}>
              <Plus className="h-3.5 w-3.5" /> Add meal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TargetsForm({ plan, memberId, onDone }: { plan: NutritionPlanWithDetails; memberId: string; onDone: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState({
    calorieTarget: plan.calorie_target ?? "",
    proteinTargetG: plan.protein_target_g ?? "",
    carbTargetG: plan.carb_target_g ?? "",
    fatTargetG: plan.fat_target_g ?? "",
    fiberTargetG: plan.fiber_target_g ?? "",
    waterTargetMl: plan.water_target_ml ?? "",
    mealFrequency: plan.meal_frequency ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await updateNutritionTargets({
      planId: plan.id,
      memberId,
      calorieTarget: values.calorieTarget === "" ? null : Number(values.calorieTarget),
      proteinTargetG: values.proteinTargetG === "" ? null : Number(values.proteinTargetG),
      carbTargetG: values.carbTargetG === "" ? null : Number(values.carbTargetG),
      fatTargetG: values.fatTargetG === "" ? null : Number(values.fatTargetG),
      fiberTargetG: values.fiberTargetG === "" ? null : Number(values.fiberTargetG),
      waterTargetMl: values.waterTargetMl === "" ? null : Number(values.waterTargetMl),
      mealFrequency: values.mealFrequency === "" ? null : Number(values.mealFrequency),
    });
    setSaving(false);
    onDone();
    router.refresh();
  }

  const fields: { key: keyof typeof values; label: string }[] = [
    { key: "calorieTarget", label: "Calories" },
    { key: "proteinTargetG", label: "Protein (g)" },
    { key: "carbTargetG", label: "Carbs (g)" },
    { key: "fatTargetG", label: "Fat (g)" },
    { key: "fiberTargetG", label: "Fiber (g)" },
    { key: "waterTargetMl", label: "Water (ml)" },
    { key: "mealFrequency", label: "Meals/day" },
  ];

  return (
    <div className="rounded-xl border p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="button" size="sm" loading={saving} onClick={save}>Save targets</Button>
      </div>
    </div>
  );
}
