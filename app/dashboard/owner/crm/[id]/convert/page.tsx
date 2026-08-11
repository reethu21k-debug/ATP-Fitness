import { notFound } from "next/navigation";
import { getLeadDetail } from "@/lib/actions/crm.actions";
import { getMemberFormOptions } from "@/lib/actions/member.actions";
import { MemberForm } from "@/components/features/members/member-form";

export const metadata = { title: "Convert lead — ATP Fitness" };

export default async function OwnerConvertLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead }, { plans, trainers }] = await Promise.all([getLeadDetail(id), getMemberFormOptions()]);
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Convert {lead.name} to a member</h1>
        <p className="mt-1 text-sm text-muted-foreground">Their account, login, and welcome message are created automatically.</p>
      </div>
      <MemberForm
        basePath="/dashboard/owner/members"
        plans={plans}
        trainers={trainers}
        leadId={id}
        defaultValues={{ fullName: lead.name, phone: lead.phone, email: lead.email ?? undefined }}
      />
    </div>
  );
}
