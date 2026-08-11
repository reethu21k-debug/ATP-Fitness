import { getCurrentProfile } from "@/lib/utils/permissions";
import { createClient } from "@/lib/supabase/server";
import { AttendanceKiosk } from "@/components/features/attendance/attendance-kiosk";

export const metadata = { title: "Check-in kiosk — ATP Fitness" };

export default async function TrainerKioskPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: gym } = await supabase.from("gyms").select("name").eq("id", profile?.gym_id ?? "").single();

  return <AttendanceKiosk gymName={gym?.name ?? "Your gym"} />;
}