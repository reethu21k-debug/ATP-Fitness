import { RenewalsPanel } from "@/components/features/members/renewals-panel";
import { hasPermission } from "@/lib/utils/permissions";

export const metadata = { title: "Renewals — ATP Fitness" };

export default async function OwnerRenewalsPage() {
  const canRemind = await hasPermission("members", "update");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Renewals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Members expiring in the next 10 days, and members whose membership has already lapsed.
        </p>
      </div>
      <RenewalsPanel memberDetailPath="/dashboard/owner/members" canRemind={canRemind} />
    </div>
  );
}