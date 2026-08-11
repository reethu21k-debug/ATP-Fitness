import { notFound } from "next/navigation";
import { getMember, getMemberFormOptions } from "@/lib/actions/member.actions";
import { getMemberPaymentHistory } from "@/lib/actions/payment.actions";
import { MemberProfileView } from "@/components/features/members/member-profile-view";

export default async function ReceptionMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [member, { plans, trainers }, paymentHistory] = await Promise.all([
    getMember(id),
    getMemberFormOptions(),
    getMemberPaymentHistory(id),
  ]);
  if (!member) notFound();

  return (
    <MemberProfileView
      member={member}
      basePath="/dashboard/reception/members"
      canDelete={false}
      plans={plans}
      trainers={trainers}
      paymentHistory={paymentHistory}
    />
  );
}
