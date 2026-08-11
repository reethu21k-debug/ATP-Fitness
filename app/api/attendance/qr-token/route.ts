import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { generateCurrentQrToken } from "@/lib/services/qr-token";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await getCurrentProfile();
  if (!profile?.gym_id || !["gym_owner", "receptionist", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const payload = generateCurrentQrToken(profile.gym_id);
  return NextResponse.json(payload);
}
