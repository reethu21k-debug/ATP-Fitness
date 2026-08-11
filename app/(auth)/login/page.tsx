import { Suspense } from "react";
import { LoginForm } from "@/components/features/auth/login-form";

export const metadata = { title: "Sign in — ATP Fitness" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
