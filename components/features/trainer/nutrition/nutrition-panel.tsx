"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { NutritionPlanDialog } from "./nutrition-plan-dialog";
import { NutritionPlanEditor } from "./nutrition-plan-editor";
import type { NutritionPlanWithDetails } from "@/lib/actions/nutrition.actions";
import type { DietPlanWithDetails } from "@/lib/actions/trainer.actions";
import { Salad, ChevronDown, ChevronUp } from "lucide-react";

export function NutritionPanel({
  memberId, nutritionPlans, legacyDietPlans,
}: {
  memberId: string;
  nutritionPlans: NutritionPlanWithDetails[];
  legacyDietPlans: DietPlanWithDetails[];
}) {
  const [showLegacy, setShowLegacy] = useState(false);
  const active = nutritionPlans.filter((p) => p.is_active);
  const inactive = nutritionPlans.filter((p) => !p.is_active);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NutritionPlanDialog memberId={memberId} /></div>

      {nutritionPlans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Salad className="h-6 w-6" />
          <p className="text-sm">No nutrition plans yet — create one to build meals with automatic macro calculation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...active, ...inactive].map((plan) => (
            <NutritionPlanEditor key={plan.id} plan={plan} memberId={memberId} />
          ))}
        </div>
      )}

      {legacyDietPlans.length > 0 && (
        <div className="rounded-xl border border-dashed">
          <button onClick={() => setShowLegacy((v) => !v)} className="flex w-full items-center justify-between p-3 text-xs font-medium text-muted-foreground">
            Previous diet plans ({legacyDietPlans.length})
            {showLegacy ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showLegacy && (
            <div className="space-y-3 border-t p-3">
              {legacyDietPlans.map((plan) => (
                <Card key={plan.id}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">{plan.title}</p>
                      {plan.daily_calorie_target && <span className="text-xs text-muted-foreground">{plan.daily_calorie_target} kcal/day</span>}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {plan.meals.map((meal) => (
                        <div key={meal.id} className="rounded-lg border p-2.5 text-xs">
                          <p className="font-medium capitalize">{meal.meal_type}</p>
                          <p className="mt-1 text-muted-foreground">{meal.items}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
