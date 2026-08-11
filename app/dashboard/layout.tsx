import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { DashboardShell } from "@/components/features/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <DashboardShell role={profile.role} fullName={profile.full_name} avatarUrl={profile.avatar_url}>
      {children}
    </DashboardShell>
  );
}
