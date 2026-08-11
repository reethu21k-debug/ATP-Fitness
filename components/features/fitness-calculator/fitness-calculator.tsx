"use client";

import { useMemo, useState } from "react";
import { Calculator, Flame, Target, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  calculateBmi,
  bmiCategory,
  calculateBmr,
  calculateMaintenanceCalories,
  calculateGoalCalories,
  calculateMacros,
  predictGoalTimeline,
  type ActivityLevel,
  type FitnessGoal,
} from "@/lib/utils/fitness";

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: "sedentary", label: "Sedentary (little to no exercise)" },
  { value: "light", label: "Lightly active (1-3 days/week)" },
  { value: "moderate", label: "Moderately active (3-5 days/week)" },
  { value: "active", label: "Active (6-7 days/week)" },
  { value: "very_active", label: "Very active (physical job + training)" },
];

const GOAL_OPTIONS: Array<{ value: FitnessGoal; label: string }> = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "maintain", label: "Maintain weight" },
  { value: "gain_muscle", label: "Gain muscle" },
];

const BMI_CATEGORY_LABEL: Record<string, string> = {
  underweight: "Underweight",
  normal: "Normal",
  overweight: "Overweight",
  obese: "Obese",
};

const BMI_CATEGORY_TONE: Record<string, string> = {
  underweight: "text-amber-600 dark:text-amber-400",
  normal: "text-emerald-600 dark:text-emerald-400",
  overweight: "text-amber-600 dark:text-amber-400",
  obese: "text-destructive",
};

export function FitnessCalculator({
  initialWeightKg,
  initialHeightCm,
  initialGender,
}: {
  initialWeightKg?: number | null;
  initialHeightCm?: number | null;
  initialGender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
}) {
  const [weightKg, setWeightKg] = useState(initialWeightKg ? String(initialWeightKg) : "");
  const [heightCm, setHeightCm] = useState(initialHeightCm ? String(initialHeightCm) : "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "prefer_not_to_say">(initialGender ?? "male");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<FitnessGoal>("maintain");
  const [targetWeightKg, setTargetWeightKg] = useState("");

  const weight = parseFloat(weightKg);
  const height = parseFloat(heightCm);
  const ageNum = parseInt(age, 10);
  const targetWeight = parseFloat(targetWeightKg);

  const bmi = useMemo(() => (weight && height ? calculateBmi(weight, height) : null), [weight, height]);
  const category = bmi != null ? bmiCategory(bmi) : null;

  const bmr = useMemo(
    () => (weight && height && ageNum ? calculateBmr({ weightKg: weight, heightCm: height, age: ageNum, gender }) : null),
    [weight, height, ageNum, gender]
  );

  const maintenance = useMemo(() => (bmr != null ? calculateMaintenanceCalories(bmr, activityLevel) : null), [bmr, activityLevel]);

  const goalCalories = useMemo(() => (maintenance != null ? calculateGoalCalories(maintenance, goal) : null), [maintenance, goal]);

  const macros = useMemo(
    () => (goalCalories != null && weight ? calculateMacros({ calorieTarget: goalCalories, weightKg: weight, goal }) : null),
    [goalCalories, weight, goal]
  );

  const prediction = useMemo(() => {
    if (goalCalories == null || maintenance == null || !weight || !targetWeight) return null;
    return predictGoalTimeline({
      currentWeightKg: weight,
      targetWeightKg: targetWeight,
      dailyCalorieTarget: goalCalories,
      maintenanceCalories: maintenance,
    });
  }, [goalCalories, maintenance, weight, targetWeight]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Your details
          </CardTitle>
          <CardDescription>Fill these in to calculate BMI, BMR, maintenance calories, and macros.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input id="weight" type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="height">Height (cm)</Label>
            <Input id="height" type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age">Age (years)</Label>
            <Input id="age" type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="28" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <Select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity">Activity level</Label>
            <Select
              id="activity"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal">Goal</Label>
            <Select
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value as FitnessGoal)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {GOAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Scale className="h-4 w-4" /> BMI
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{bmi ?? "—"}</p>
            {category && <p className={`mt-1 text-sm font-medium ${BMI_CATEGORY_TONE[category]}`}>{BMI_CATEGORY_LABEL[category]}</p>}
            {!bmi && <p className="mt-1 text-sm text-muted-foreground">Enter weight and height above.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="h-4 w-4" /> BMR
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{bmr != null ? bmr.toLocaleString() : "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">calories/day at rest</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily calorie & macro targets</CardTitle>
          <CardDescription>Based on your maintenance calories, activity level, and goal.</CardDescription>
        </CardHeader>
        <CardContent>
          {goalCalories == null ? (
            <p className="text-sm text-muted-foreground">Fill in your details above to see your targets.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Maintenance</p>
                <p className="mt-1 text-xl font-semibold">{maintenance?.toLocaleString()} kcal</p>
              </div>
              <div className="rounded-xl border bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Daily target</p>
                <p className="mt-1 text-xl font-semibold text-primary">{goalCalories.toLocaleString()} kcal</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Protein</p>
                <p className="mt-1 text-xl font-semibold">{macros?.proteinG} g</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Fat / Carbs</p>
                <p className="mt-1 text-xl font-semibold">
                  {macros?.fatG} g / {macros?.carbsG} g
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Goal timeline (optional)
          </CardTitle>
          <CardDescription>Add a target weight to estimate roughly how long it'll take at your current calorie target.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="targetWeight">Target weight (kg)</Label>
            <Input
              id="targetWeight"
              type="number"
              inputMode="decimal"
              value={targetWeightKg}
              onChange={(e) => setTargetWeightKg(e.target.value)}
              placeholder="65"
            />
          </div>
          {targetWeightKg && goalCalories != null && (
            <div className="rounded-xl border p-4">
              {prediction ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    At roughly <span className="font-medium text-foreground">{Math.abs(prediction.weeklyChangeKg)} kg/week</span>, you'll reach{" "}
                    {targetWeight} kg in about:
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-primary">{prediction.weeksToGoal} weeks</p>
                  <p className="mt-1 text-xs text-muted-foreground">Estimated target date: {prediction.targetDate}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your current goal ("{GOAL_OPTIONS.find((g) => g.value === goal)?.label}") doesn't move toward this target weight — switch your
                  goal above to match the direction you want to go.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        These are estimates using standard formulas (Mifflin-St Jeor for BMR, ~7700 kcal per kg of body fat for the timeline) — actual results vary
        by individual. For medical conditions or specific dietary needs, talk to your trainer or a doctor.
      </p>
    </div>
  );
}
