import { CrmDashboard } from "@/components/features/crm/crm-dashboard";

export const metadata = { title: "CRM — ATP Fitness" };

export default function ReceptionCrmPage() {
  return <CrmDashboard basePath="/dashboard/reception/crm" />;
}
