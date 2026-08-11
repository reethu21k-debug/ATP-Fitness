import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { PlatformOverview } from "@/components/features/platform/platform-overview";

export default async function PlatformOverviewPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  return <PlatformOverview />;
}
