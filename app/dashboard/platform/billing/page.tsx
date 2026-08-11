import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { BillingTabs } from "@/components/features/platform/billing-tabs";

export default async function PlatformBillingPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the platform&apos;s pricing plans and issue/track SaaS invoices to tenants.
        </p>
      </div>
      <BillingTabs />
    </div>
  );
}
