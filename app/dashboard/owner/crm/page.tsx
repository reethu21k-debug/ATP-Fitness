import { CrmDashboard } from "@/components/features/crm/crm-dashboard";

export const metadata = { title: "CRM — ATP Fitness" };

export default function OwnerCrmPage() {
  return <CrmDashboard basePath="/dashboard/owner/crm" />;
}
