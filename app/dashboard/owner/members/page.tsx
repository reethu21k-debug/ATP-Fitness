import { MembersTable } from "@/components/features/members/members-table";

export const metadata = { title: "Members — ATP Fitness" };

export default function OwnerMembersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every member, their plan, and payment status in one place.</p>
      </div>
      <MembersTable basePath="/dashboard/owner/members" />
    </div>
  );
}
