import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { TenantDetailView } from "@/components/features/platform/tenant-detail-view";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { id } = await params;
  return <TenantDetailView tenantId={id} />;
}
