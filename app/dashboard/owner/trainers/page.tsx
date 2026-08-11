import { TrainersDashboard } from "@/components/features/staff/trainers-dashboard";

export const metadata = { title: "Trainers & Staff — ATP Fitness" };

export default function OwnerTrainersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trainers & Staff</h1>
        <p className="text-sm text-muted-foreground">
          Manage trainers and receptionists for your currently active branch. Switch branches from the top bar to manage another location's team.
        </p>
      </div>
      <TrainersDashboard />
    </div>
  );
}
