import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

export const metadata = { title: "Set a new password — ATP Fitness" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? null} />;
}