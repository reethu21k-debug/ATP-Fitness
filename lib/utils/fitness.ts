/** Body Mass Index = weight(kg) / height(m)^2, rounded to 1 decimal. */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

/** Standard WHO BMI bands. */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

/** Multipliers applied to BMR to estimate total daily maintenance calories. */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Basal Metabolic Rate via the Mifflin-St Jeor equation — the formula most
 * widely used in modern clinical/fitness practice (more accurate across a
 * broad population than the older Harris-Benedict equation).
 *
 *   Men:   BMR = 10*weight(kg) + 6.25*height(cm) - 5*age + 5
 *   Women: BMR = 10*weight(kg) + 6.25*height(cm) - 5*age - 161
 *
 * "other"/"prefer_not_to_say" uses the average of the male/female offset,
 * since the equation has no third term derived for those cases — this is a
 * reasonable, clearly-documented approximation rather than a silent choice.
 */
export function calculateBmr(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: "male" | "female" | "other" | "prefer_not_to_say";
}): number | null {
  const { weightKg, heightCm, age, gender } = input;
  if (!weightKg || !heightCm || !age) return null;

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = gender === "male" ? 5 : gender === "female" ? -161 : -78; // avg of +5 and -161

  return Math.round(base + offset);
}

/** Total Daily Energy Expenditure — maintenance calories at a given activity level. */
export function calculateMaintenanceCalories(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export type FitnessGoal = "lose_weight" | "maintain" | "gain_muscle";

/**
 * Daily calorie target for a goal, applied as a percentage adjustment to
 * maintenance rather than a fixed absolute number, so it scales sensibly
 * across body sizes. ±20% is a widely-used moderate range for sustainable
 * weight change without being aggressive enough to risk muscle loss (cutting)
 * or excess fat gain (bulking).
 */
export function calculateGoalCalories(maintenanceCalories: number, goal: FitnessGoal): number {
  const adjustment = goal === "lose_weight" ? 0.8 : goal === "gain_muscle" ? 1.15 : 1;
  return Math.round(maintenanceCalories * adjustment);
}

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/**
 * Macro split from a calorie target + goal + bodyweight.
 * Protein is anchored to bodyweight (the evidence-based approach — g/kg,
 * not a % of calories, since protein needs track lean mass) at 2.0g/kg for
 * fat loss and muscle gain (higher end of the range to protect/build lean
 * mass) and 1.6g/kg for maintenance. Fat is set to 25% of total calories
 * (within the commonly recommended 20-35% range). Remaining calories go to
 * carbs.
 */
export function calculateMacros(input: { calorieTarget: number; weightKg: number; goal: FitnessGoal }): MacroTargets {
  const { calorieTarget, weightKg, goal } = input;
  const proteinPerKg = goal === "maintain" ? 1.6 : 2.0;
  const proteinG = Math.round(proteinPerKg * weightKg);
  const proteinCalories = proteinG * 4;

  const fatCalories = calorieTarget * 0.25;
  const fatG = Math.round(fatCalories / 9);

  const remainingCalories = Math.max(0, calorieTarget - proteinCalories - fatCalories);
  const carbsG = Math.round(remainingCalories / 4);

  return { proteinG, fatG, carbsG };
}

export interface GoalPrediction {
  weeksToGoal: number;
  targetDate: string; // ISO date
  weeklyChangeKg: number;
}

/**
 * Simple, transparent goal-timeline projection from a calorie surplus/deficit.
 * 1kg of body fat ≈ 7700 kcal — the standard estimate used across fitness
 * literature. Deliberately not fancier than that: a rough, explainable
 * estimate for a member to plan around, not a medical prediction.
 */
export function predictGoalTimeline(input: {
  currentWeightKg: number;
  targetWeightKg: number;
  dailyCalorieTarget: number;
  maintenanceCalories: number;
  fromDate?: Date;
}): GoalPrediction | null {
  const { currentWeightKg, targetWeightKg, dailyCalorieTarget, maintenanceCalories } = input;
  const weightDiff = targetWeightKg - currentWeightKg;
  if (weightDiff === 0) return { weeksToGoal: 0, targetDate: (input.fromDate ?? new Date()).toISOString().slice(0, 10), weeklyChangeKg: 0 };

  const dailyCalorieDelta = dailyCalorieTarget - maintenanceCalories;
  // Losing weight needs a deficit (negative delta); gaining needs a surplus (positive delta).
  const movingRightDirection = (weightDiff < 0 && dailyCalorieDelta < 0) || (weightDiff > 0 && dailyCalorieDelta > 0);
  if (!movingRightDirection || dailyCalorieDelta === 0) return null;

  const weeklyCalorieDelta = dailyCalorieDelta * 7;
  const weeklyChangeKg = weeklyCalorieDelta / 7700;
  const weeksToGoal = Math.ceil(Math.abs(weightDiff / weeklyChangeKg));

  const target = new Date(input.fromDate ?? new Date());
  target.setDate(target.getDate() + weeksToGoal * 7);

  return {
    weeksToGoal,
    targetDate: target.toISOString().slice(0, 10),
    weeklyChangeKg: Math.round(weeklyChangeKg * 100) / 100,
  };
}

