import { notFound } from "next/navigation";
import { getMember } from "@/lib/actions/member.actions";
import { getWorkoutPlans, getDietPlans, getProgressHistory, getMemberHeightCm } from "@/lib/actions/trainer.actions";
import { getNutritionPlans } from "@/lib/actions/nutrition.actions";
import { ClientWorkspace } from "@/components/features/trainer/client-workspace";

export default async function TrainerClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [member, workoutPlans, dietPlans, nutritionPlans, progress, heightCm] = await Promise.all([
    getMember(id),
    getWorkoutPlans(id),
    getDietPlans(id),
    getNutritionPlans(id),
    getProgressHistory(id, "year"),
    getMemberHeightCm(id),
  ]);
  if (!member) notFound();

  return (
    <ClientWorkspace
      member={member}
      heightCm={heightCm}
      workoutPlans={workoutPlans}
      dietPlans={dietPlans}
      nutritionPlans={nutritionPlans}
      progress={progress}
    />
  );
}
