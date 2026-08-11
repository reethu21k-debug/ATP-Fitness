import { ForcedResetPasswordForm } from "@/components/features/auth/forced-reset-password-form";

export const metadata = { title: "Set your password — ATP Fitness" };

// Middleware sends any logged-in user with must_reset_password=true here
// (see lib/supabase/middleware.ts) -- typically right after first login
// with the temporary password from their welcome email.
export default function DashboardResetPasswordPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ForcedResetPasswordForm />
    </div>
  );
}