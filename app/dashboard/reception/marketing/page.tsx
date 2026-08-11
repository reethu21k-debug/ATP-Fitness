import { MarketingDashboard } from "@/components/features/marketing/marketing-dashboard";

export const metadata = { title: "Marketing — ATP Fitness" };

export default function ReceptionMarketingPage() {
  return <MarketingDashboard basePath="/dashboard/reception/marketing" canManage={false} />;
}
