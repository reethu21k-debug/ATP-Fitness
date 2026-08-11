import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { SubscriptionInfoCard } from "@/components/features/settings/subscription-info-card";
import { SupportTicketsPanel } from "@/components/features/settings/support-tickets-panel";

export default async function OwnerSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "gym_owner") redirect("/dashboard");
  if (!profile.tenant_id) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your subscription, billing status, and support.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SubscriptionInfoCard tenantId={profile.tenant_id} />
        <SupportTicketsPanel />
      </div>
    </div>
  );
}
