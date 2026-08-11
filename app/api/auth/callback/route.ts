import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ROLE_HOME: Record<string, string> = {
  super_admin: "/dashboard/platform",
  gym_owner: "/dashboard/owner",
  receptionist: "/dashboard/reception",
  trainer: "/dashboard/trainer",
  member: "/dashboard/member",
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const destination = profile ? ROLE_HOME[profile.role] ?? "/dashboard" : "/dashboard";
  return NextResponse.redirect(`${origin}${destination}`);
}
