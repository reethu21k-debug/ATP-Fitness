import { MemberForm } from "@/components/features/members/member-form";
import { getMemberFormOptions } from "@/lib/actions/member.actions";

export const metadata = { title: "Add member — ATP Fitness" };

export default async function NewReceptionMemberPage() {
  const { plans, trainers } = await getMemberFormOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add a member</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Their account, login, and welcome message are created automatically.
        </p>
      </div>
      <MemberForm basePath="/dashboard/reception/members" plans={plans} trainers={trainers} />
    </div>
  );
}
