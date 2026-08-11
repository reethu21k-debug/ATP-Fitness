import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { getPlatformSettings, listFeatureFlagCatalog } from "@/lib/actions/platform.actions";
import { PlatformSettingsForm } from "@/components/features/platform/platform-settings-form";
import { FeatureFlagCatalogCard } from "@/components/features/platform/feature-flag-catalog-card";

export default async function PlatformSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const [settingsRes, catalogRes] = await Promise.all([getPlatformSettings(), listFeatureFlagCatalog()]);

  if (!settingsRes.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
        <p className="text-sm text-destructive">{settingsRes.error}</p>
      </div>
    );
  }
  if (!settingsRes.data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
        <p className="text-sm text-destructive">Platform settings could not be loaded.</p>
      </div>
    );
  }

  const catalog = catalogRes.success ? catalogRes.data ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global configuration and the feature flag registry available to every tenant.
        </p>
      </div>
      <PlatformSettingsForm settings={settingsRes.data} />
      <FeatureFlagCatalogCard catalog={catalog} />
    </div>
  );
}
