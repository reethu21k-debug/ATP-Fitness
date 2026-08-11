import { getCurrentProfile } from "@/lib/utils/permissions";
import { createClient } from "@/lib/supabase/server";
import { getProgressHistory, getMemberHeightCm } from "@/lib/actions/trainer.actions";
import { FitnessCalculator } from "@/components/features/fitness-calculator/fitness-calculator";

export const metadata = { title: "Fitness Calculator — ATP Fitness" };

export default async function FitnessCalculatorPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const [progress, heightCm, { data: details }] = await Promise.all([
    getProgressHistory(profile.id, "month"),
    getMemberHeightCm(profile.id),
    supabase.from("member_details").select("gender").eq("profile_id", profile.id).single(),
  ]);

  const latestWeight = progress.length > 0 ? progress[progress.length - 1]?.weight_kg ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fitness Calculator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          BMI, BMR, maintenance calories, macros, and a rough timeline for your goal.
        </p>
      </div>
      <FitnessCalculator initialWeightKg={latestWeight} initialHeightCm={heightCm} initialGender={details?.gender ?? null} />
    </div>
  );
}
