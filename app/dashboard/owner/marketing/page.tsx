import { MarketingDashboard } from "@/components/features/marketing/marketing-dashboard";

export const metadata = { title: "Marketing — ATP Fitness" };

export default function OwnerMarketingPage() {
  return <MarketingDashboard basePath="/dashboard/owner/marketing" canManage={true} />;
}
