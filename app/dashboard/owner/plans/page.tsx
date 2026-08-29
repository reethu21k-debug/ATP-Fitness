import { PlansPanel } from "@/components/features/plans/plans-panel";

export const metadata = { title: "Membership Plans — ATP Fitness" };

export default function OwnerPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Membership Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and edit the plans members can sign up for — name, duration, and price.
        </p>
      </div>
      <PlansPanel />
    </div>
  );
}