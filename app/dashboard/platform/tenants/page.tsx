import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { TenantsTable } from "@/components/features/platform/tenants-table";

export default async function TenantsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every gym business on the platform — subscription status, usage, and admin actions.
        </p>
      </div>
      <TenantsTable />
    </div>
  );
}
