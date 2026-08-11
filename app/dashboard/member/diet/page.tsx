import { getCurrentProfile } from "@/lib/utils/permissions";
import { getDietPlans, type DietPlanWithDetails } from "@/lib/actions/trainer.actions";
import { getNutritionPlans, type NutritionPlanWithDetails } from "@/lib/actions/nutrition.actions";
import { calculateMealTotals, calculateDailyTotals, calculateMacroProgress, formatQuantity, FOOD_STATE_LABELS } from "@/lib/services/nutrition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Salad } from "lucide-react";

export const metadata = { title: "Nutrition — ATP Fitness" };

export default async function MemberDietPage() {
  const profile = await getCurrentProfile();
  const [nutritionPlans, legacyPlans]: [NutritionPlanWithDetails[], DietPlanWithDetails[]] = profile
    ? await Promise.all([getNutritionPlans(profile.id), getDietPlans(profile.id)])
    : [[], []];

  const activeNutrition = nutritionPlans.filter((p) => p.is_active);
  const activeLegacy = legacyPlans.filter((p) => p.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your nutrition plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Daily targets and meals set by your trainer.</p>
      </div>

      {activeNutrition.length === 0 && activeLegacy.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Salad className="h-6 w-6" />
          <p className="text-sm">No active nutrition plan yet.</p>
        </div>
      ) : (
        <>
          {activeNutrition.map((plan) => {
            const daily = calculateDailyTotals(plan.meals);
            return (
              <Card key={plan.id}>
                <CardContent className="space-y-5 p-5">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.duration_days} day plan</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-4">
                    {([
                      ["Calories", daily.calories, plan.calorie_target, "kcal"],
                      ["Protein", daily.proteinG, plan.protein_target_g, "g"],
                      ["Carbs", daily.carbsG, plan.carb_target_g, "g"],
                      ["Fat", daily.fatG, plan.fat_target_g, "g"],
                    ] as const).map(([label, actual, target, unit]) => {
                      const progress = calculateMacroProgress(actual, target);
                      return (
                        <div key={label} className="rounded-lg border p-2.5">
                          <p className="text-xs font-medium">{label}</p>
                          <p className="text-sm">{actual}{unit} {target ? `/ ${target}${unit}` : ""}</p>
                          {target ? <Progress value={Math.min(100, progress.pct)} className="mt-1.5 h-1.5" /> : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3">
                    {plan.meals.map((meal) => {
                      const totals = calculateMealTotals(meal.items);
                      return (
                        <div key={meal.id} className="rounded-lg border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold uppercase tracking-wide">{meal.name}</p>
                            <span className="text-xs text-muted-foreground">{totals.calories} kcal</span>
                          </div>
                          <div className="space-y-1.5">
                            {meal.items.map((item) => (
                              <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                                <span className="break-words">
                                  {item.food.name}
                                  {FOOD_STATE_LABELS[item.food.state] && <span className="text-xs text-muted-foreground"> ({FOOD_STATE_LABELS[item.food.state]})</span>}
                                </span>
                                <Badge variant="secondary" className="shrink-0">{formatQuantity(item.quantity, item.unit)}</Badge>
                              </div>
                            ))}
                            {meal.items.length === 0 && <p className="text-xs text-muted-foreground">No foods added yet.</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {activeLegacy.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold">{plan.title}</p>
                  {plan.daily_calorie_target && <span className="text-sm text-muted-foreground">{plan.daily_calorie_target} kcal/day</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {plan.meals.map((meal) => (
                    <div key={meal.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium capitalize">{meal.meal_type}</p>
                      <p className="mt-1 text-muted-foreground">{meal.items}</p>
                      {meal.calories && <p className="mt-1 text-xs text-muted-foreground">{meal.calories} kcal</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
