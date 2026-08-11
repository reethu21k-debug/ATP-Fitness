"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission } from "@/lib/utils/permissions";
import { verifyQrToken } from "@/lib/services/qr-token";
import { distanceMeters } from "@/lib/utils/geo";
import type { ActionResult } from "./auth.actions";
import type { MemberStreak, MemberStreakOverviewRow } from "@/types/database";

export interface CheckInInput {
  gymId: string;
  bucket: number;
  token: string;
  gps?: { lat: number; lng: number } | null;
}

// ============================================================================
// CHECK IN — the member scans the kiosk's rotating QR with their own phone.
// Validates: token freshness (QR), active membership, no duplicate open
// session, and optionally GPS proximity to the gym.
// ============================================================================
export async function checkInMember(input: CheckInInput): Promise<ActionResult<{ attendanceId: string; gpsVerified: boolean }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated." };
  if (profile.role !== "member") return { success: false, error: "Only members check in with the QR scanner." };
  if (profile.gym_id !== input.gymId) return { success: false, error: "This QR code belongs to a different gym." };

  if (!verifyQrToken(input.gymId, input.bucket, input.token)) {
    return { success: false, error: "This QR code has expired. Ask the front desk to refresh it and scan again." };
  }

  const supabase = await createClient();

  // Membership validity check.
  const { data: membership } = await supabase
    .from("member_memberships")
    .select("end_date")
    .eq("member_id", profile.id)
    .eq("is_current", true)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  if (!membership || membership.end_date < today) {
    return { success: false, error: "Your membership has expired. Please renew at the front desk to check in." };
  }

  // Duplicate check — one open session at a time (also enforced by a unique index).
  const { data: openSession } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("member_id", profile.id)
    .is("check_out_at", null)
    .maybeSingle();
  if (openSession) {
    return { success: false, error: "You're already checked in. Check out first if this is a new visit." };
  }

  // Optional GPS verification.
  let gpsVerified = false;
  if (input.gps) {
    const { data: gym } = await supabase
      .from("gyms")
      .select("latitude, longitude, gps_checkin_radius_meters")
      .eq("id", input.gymId)
      .single();
    if (gym?.latitude != null && gym.longitude != null) {
      const distance = distanceMeters(input.gps.lat, input.gps.lng, gym.latitude, gym.longitude);
      gpsVerified = distance <= (gym.gps_checkin_radius_meters ?? 200);
    }
  }

  const { data: record, error } = await supabase
    .from("attendance_records")
    .insert({
      gym_id: input.gymId,
      member_id: profile.id,
      method: "qr",
      gps_lat: input.gps?.lat ?? null,
      gps_lng: input.gps?.lng ?? null,
      gps_verified: gpsVerified,
    })
    .select()
    .single();

  if (error || !record) {
    // The unique partial index on (member_id) where check_out_at is null
    // catches races where two check-ins land at nearly the same time.
    return { success: false, error: "Could not record your check-in. You may already be checked in." };
  }

  revalidatePath("/dashboard/member/attendance");
  revalidatePath("/dashboard/owner/attendance");
  revalidatePath("/dashboard/reception/attendance");
  return { success: true, data: { attendanceId: record.id, gpsVerified } };
}

// ============================================================================
// CHECK OUT
// ============================================================================
export async function checkOutMember(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { data: openSession } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("member_id", profile.id)
    .is("check_out_at", null)
    .maybeSingle();

  if (!openSession) return { success: false, error: "You don't have an active check-in." };

  const { error } = await supabase
    .from("attendance_records")
    .update({ check_out_at: new Date().toISOString() })
    .eq("id", openSession.id);

  if (error) return { success: false, error: "Could not check you out. Try again." };

  revalidatePath("/dashboard/member/attendance");
  revalidatePath("/dashboard/owner/attendance");
  revalidatePath("/dashboard/reception/attendance");
  return { success: true };
}

// ============================================================================
// MANUAL CHECK-IN (front desk override — e.g. member forgot their phone)
// ============================================================================
export async function manualCheckIn(memberId: string): Promise<ActionResult> {
  try {
    await requirePermission("attendance", "create");
  } catch {
    return { success: false, error: "You do not have permission to record attendance." };
  }

  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_records").insert({
    gym_id: actor.gym_id,
    member_id: memberId,
    method: "manual",
    checked_in_by: actor.id,
  });
  if (error) return { success: false, error: "Could not record check-in. They may already be checked in today." };

  revalidatePath("/dashboard/owner/attendance");
  revalidatePath("/dashboard/reception/attendance");
  return { success: true };
}

// ============================================================================
// MEMBER'S OWN STATUS + HISTORY
// ============================================================================
export async function getMyAttendanceStatus() {
  const profile = await getCurrentProfile();
  if (!profile) return { checkedIn: false, session: null };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("member_id", profile.id)
    .is("check_out_at", null)
    .maybeSingle();

  return { checkedIn: !!session, session };
}

export async function getMyAttendanceHistory() {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("member_id", profile.id)
    .order("check_in_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

// ============================================================================
// FRONT-DESK DASHBOARD DATA
// ============================================================================
export async function getTodayAttendance() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("attendance_today").select("*").eq("gym_id", actor.gym_id);
  return data ?? [];
}

export async function getAttendanceStats() {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { todayCount: 0, avgDurationMinutes: 0, peakHours: [] as { hour: number; count: number }[] };

  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: records } = await admin
    .from("attendance_records")
    .select("check_in_at, duration_minutes")
    .eq("gym_id", actor.gym_id)
    .gte("check_in_at", thirtyDaysAgo);

  const rows = records ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => r.check_in_at.slice(0, 10) === today).length;

  const completed = rows.filter((r) => r.duration_minutes != null);
  const avgDurationMinutes = completed.length
    ? Math.round(completed.reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0) / completed.length)
    : 0;

  const hourCounts = new Array(24).fill(0);
  for (const r of rows) hourCounts[new Date(r.check_in_at).getHours()]++;
  const peakHours = hourCounts.map((count, hour) => ({ hour, count }));

  return { todayCount, avgDurationMinutes, peakHours };
}

// ============================================================================
// STREAKS
// Streak rows are maintained entirely by a DB trigger on attendance_records
// insert (see migration 0022), so these are read-only fetchers.
// ============================================================================

// Member's own streak, for their attendance page.
export async function getMyStreak(): Promise<MemberStreak | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("member_streaks")
    .select("*")
    .eq("member_id", profile.id)
    .maybeSingle();

  return data ?? null;
}

// Gym-wide streak leaderboard + at-risk list, for owner/reception engagement
// tracking. "At risk" members haven't checked in today and will lose their
// streak tomorrow if they don't (or if they've already used this week's grace).
export async function getGymStreaksOverview(): Promise<{
  topStreaks: MemberStreakOverviewRow[];
  atRisk: MemberStreakOverviewRow[];
}> {
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { topStreaks: [], atRisk: [] };

  const supabase = await createClient();
  const { data } = await supabase
    .from("member_streaks_overview")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("current_streak", { ascending: false });

  const rows = data ?? [];
  const topStreaks = rows.slice(0, 10);
  const atRisk = rows
    .filter((r) => r.days_since_checkin >= 1)
    .sort((a, b) => b.current_streak - a.current_streak)
    .slice(0, 10);

  return { topStreaks, atRisk };
}