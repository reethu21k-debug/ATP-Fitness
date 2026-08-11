import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { TicketsTable } from "@/components/features/platform/tickets-table";

export default async function PlatformTicketsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tickets raised by gym owners across every tenant, with threaded replies and internal notes.
        </p>
      </div>
      <TicketsTable />
    </div>
  );
}
