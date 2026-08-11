import { getCurrentProfile } from "@/lib/utils/permissions";
import { getWorkoutPlans, type WorkoutPlanWithDetails } from "@/lib/actions/trainer.actions";
import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle, Dumbbell } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "Workout — ATP Fitness" };

export default async function MemberWorkoutPage() {
  const profile = await getCurrentProfile();
  const plans: WorkoutPlanWithDetails[] = profile ? await getWorkoutPlans(profile.id) : [];
  const activePlans = plans.filter((p) => p.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your workout plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set by your trainer — sets, reps, and weight for each session.</p>
      </div>

      {activePlans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Dumbbell className="h-6 w-6" />
          <p className="text-sm">No active workout plan yet. Your trainer will set one up soon.</p>
        </div>
      ) : (
        activePlans.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="p-5">
              <div className="mb-4">
                <p className="font-semibold">{plan.title}</p>
                <p className="text-xs text-muted-foreground capitalize">{plan.frequency} · from {format(new Date(plan.start_date), "dd MMM yyyy")}</p>
              </div>
              <div className="space-y-3">
                {plan.days.map((day) => (
                  <div key={day.id} className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-medium">{day.day_label}</p>
                    <div className="space-y-1.5">
                      {day.exercises.map((ex) => (
                        <div key={ex.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                          <span className="break-words">{ex.exercise_name}</span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            {ex.sets && `${ex.sets} sets`} {ex.reps && `× ${ex.reps}`} {ex.weight_kg && `@ ${ex.weight_kg}kg`}
                            {ex.video_url && (
                              <a href={ex.video_url} target="_blank" rel="noreferrer">
                                <PlayCircle className="h-3.5 w-3.5 text-primary" />
                              </a>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
