import { MembersTable } from "@/components/features/members/members-table";

export const metadata = { title: "Members — ATP Fitness" };

export default function ReceptionMembersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add walk-ins, renew memberships, and collect payments.</p>
      </div>
      <MembersTable basePath="/dashboard/reception/members" />
    </div>
  );
}
