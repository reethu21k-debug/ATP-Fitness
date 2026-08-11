import { describe, it, expect } from "vitest";
import {
  calculateBmi,
  bmiCategory,
  calculateBmr,
  calculateMaintenanceCalories,
  calculateGoalCalories,
  calculateMacros,
  predictGoalTimeline,
} from "@/lib/utils/fitness";

describe("calculateBmi", () => {
  it("computes BMI from weight and height", () => {
    expect(calculateBmi(70, 175)).toBe(22.9);
  });

  it("returns null when weight is missing", () => {
    expect(calculateBmi(0, 175)).toBeNull();
  });

  it("returns null when height is missing", () => {
    expect(calculateBmi(70, 0)).toBeNull();
  });

  it("rounds to 1 decimal place", () => {
    expect(calculateBmi(82, 180)).toBe(25.3);
  });
});

describe("bmiCategory", () => {
  it("classifies underweight below 18.5", () => {
    expect(bmiCategory(17)).toBe("underweight");
    expect(bmiCategory(18.4)).toBe("underweight");
  });

  it("classifies normal between 18.5 and 25", () => {
    expect(bmiCategory(18.5)).toBe("normal");
    expect(bmiCategory(22)).toBe("normal");
    expect(bmiCategory(24.9)).toBe("normal");
  });

  it("classifies overweight between 25 and 30", () => {
    expect(bmiCategory(25)).toBe("overweight");
    expect(bmiCategory(29.9)).toBe("overweight");
  });

  it("classifies obese at 30 and above", () => {
    expect(bmiCategory(30)).toBe("obese");
    expect(bmiCategory(35)).toBe("obese");
  });
});

describe("calculateBmr", () => {
  it("computes BMR for a male using Mifflin-St Jeor", () => {
    // 10*70 + 6.25*175 - 5*28 + 5 = 700 + 1093.75 - 140 + 5 = 1658.75 -> rounds to 1659
    expect(calculateBmr({ weightKg: 70, heightCm: 175, age: 28, gender: "male" })).toBe(1659);
  });

  it("computes BMR for a female using Mifflin-St Jeor", () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 -> rounds to 1320
    expect(calculateBmr({ weightKg: 60, heightCm: 165, age: 30, gender: "female" })).toBe(1320);
  });

  it("uses an averaged offset for other/unspecified gender", () => {
    // offset = -78 (average of +5 and -161)
    // 10*70 + 6.25*175 - 5*28 - 78 = 700 + 1093.75 - 140 - 78 = 1575.75 -> 1576
    expect(calculateBmr({ weightKg: 70, heightCm: 175, age: 28, gender: "other" })).toBe(1576);
  });

  it("returns null when any required input is missing", () => {
    expect(calculateBmr({ weightKg: 0, heightCm: 175, age: 28, gender: "male" })).toBeNull();
    expect(calculateBmr({ weightKg: 70, heightCm: 0, age: 28, gender: "male" })).toBeNull();
    expect(calculateBmr({ weightKg: 70, heightCm: 175, age: 0, gender: "male" })).toBeNull();
  });
});

describe("calculateMaintenanceCalories", () => {
  it("applies the sedentary multiplier (1.2)", () => {
    expect(calculateMaintenanceCalories(1600, "sedentary")).toBe(1920);
  });

  it("applies the moderate multiplier (1.55)", () => {
    expect(calculateMaintenanceCalories(1600, "moderate")).toBe(2480);
  });

  it("applies the very_active multiplier (1.9)", () => {
    expect(calculateMaintenanceCalories(1600, "very_active")).toBe(3040);
  });
});

describe("calculateGoalCalories", () => {
  it("applies a 20% deficit for weight loss", () => {
    expect(calculateGoalCalories(2000, "lose_weight")).toBe(1600);
  });

  it("keeps calories unchanged for maintenance", () => {
    expect(calculateGoalCalories(2000, "maintain")).toBe(2000);
  });

  it("applies a 15% surplus for muscle gain", () => {
    expect(calculateGoalCalories(2000, "gain_muscle")).toBe(2300);
  });
});

describe("calculateMacros", () => {
  it("uses 2.0g/kg protein for a weight-loss goal", () => {
    const result = calculateMacros({ calorieTarget: 1800, weightKg: 70, goal: "lose_weight" });
    expect(result.proteinG).toBe(140); // 2.0 * 70
  });

  it("uses 1.6g/kg protein for maintenance", () => {
    const result = calculateMacros({ calorieTarget: 2200, weightKg: 70, goal: "maintain" });
    expect(result.proteinG).toBe(112); // 1.6 * 70
  });

  it("uses 2.0g/kg protein for muscle gain", () => {
    const result = calculateMacros({ calorieTarget: 2500, weightKg: 80, goal: "gain_muscle" });
    expect(result.proteinG).toBe(160); // 2.0 * 80
  });

  it("allocates fat at 25% of total calories", () => {
    const result = calculateMacros({ calorieTarget: 2000, weightKg: 70, goal: "maintain" });
    // fat calories = 2000 * 0.25 = 500 -> 500/9 = 55.56 -> rounds to 56
    expect(result.fatG).toBe(56);
  });

  it("allocates remaining calories to carbs and never goes negative", () => {
    const result = calculateMacros({ calorieTarget: 1200, weightKg: 100, goal: "lose_weight" });
    // protein = 200g -> 800 kcal, fat = 300 kcal -> remaining = 1200-800-300 = 100 -> negative clamp not needed here
    expect(result.carbsG).toBeGreaterThanOrEqual(0);
  });

  it("clamps carbs to zero when protein + fat already exceed the calorie target", () => {
    // Very low calorie target relative to bodyweight-driven protein need.
    const result = calculateMacros({ calorieTarget: 400, weightKg: 100, goal: "lose_weight" });
    expect(result.carbsG).toBe(0);
  });
});

describe("predictGoalTimeline", () => {
  it("returns zero weeks when already at the target weight", () => {
    const result = predictGoalTimeline({
      currentWeightKg: 70,
      targetWeightKg: 70,
      dailyCalorieTarget: 2000,
      maintenanceCalories: 2200,
    });
    expect(result?.weeksToGoal).toBe(0);
  });

  it("predicts a timeline for weight loss with a calorie deficit", () => {
    // deficit = 2000 - 2500 = -500/day -> -3500/week -> -0.4545 kg/week
    const result = predictGoalTimeline({
      currentWeightKg: 80,
      targetWeightKg: 75,
      dailyCalorieTarget: 2000,
      maintenanceCalories: 2500,
    });
    expect(result).not.toBeNull();
    expect(result!.weeklyChangeKg).toBeLessThan(0);
    expect(result!.weeksToGoal).toBeGreaterThan(0);
  });

  it("predicts a timeline for weight gain with a calorie surplus", () => {
    const result = predictGoalTimeline({
      currentWeightKg: 65,
      targetWeightKg: 70,
      dailyCalorieTarget: 2800,
      maintenanceCalories: 2400,
    });
    expect(result).not.toBeNull();
    expect(result!.weeklyChangeKg).toBeGreaterThan(0);
  });

  it("returns null when the calorie target moves the wrong direction for the goal", () => {
    // Wants to lose weight but calorie target is above maintenance (surplus).
    const result = predictGoalTimeline({
      currentWeightKg: 80,
      targetWeightKg: 75,
      dailyCalorieTarget: 2600,
      maintenanceCalories: 2400,
    });
    expect(result).toBeNull();
  });

  it("returns null when the calorie target exactly equals maintenance (no delta)", () => {
    const result = predictGoalTimeline({
      currentWeightKg: 80,
      targetWeightKg: 75,
      dailyCalorieTarget: 2400,
      maintenanceCalories: 2400,
    });
    expect(result).toBeNull();
  });
});
