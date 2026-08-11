import { BranchesDashboard } from "@/components/features/branches/branches-dashboard";

export const metadata = { title: "Branches — ATP Fitness" };

export default function OwnerBranchesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Branches</h1>
        <p className="text-sm text-muted-foreground">
          Manage every location under your account, switch which branch you're working in, and compare performance across all of them.
        </p>
      </div>
      <BranchesDashboard />
    </div>
  );
}
