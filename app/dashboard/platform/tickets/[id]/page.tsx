import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { getTicketWithMessages } from "@/lib/actions/platform.actions";
import { TicketThread } from "@/components/features/platform/ticket-thread";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { id } = await params;
  const result = await getTicketWithMessages(id);
  if (!result.success || !result.data) notFound();

  return <TicketThread ticket={result.data.ticket} messages={result.data.messages} />;
}
