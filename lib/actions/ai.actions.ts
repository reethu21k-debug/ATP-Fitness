"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRole, PermissionError } from "@/lib/utils/permissions";
import { generateJson, generateText, AnthropicNotConfiguredError } from "@/lib/services/anthropic";
import { calculateBmi } from "@/lib/utils/fitness";
import type { ActionResult } from "./auth.actions";
import type { RiskLevel } from "@/types/database";

function friendlyAiError(err: unknown): string {
  if (err instanceof AnthropicNotConfiguredError) return err.message;
  return err instanceof Error ? err.message : "The AI service is unavailable right now. Please try again.";
}

// ============================================================================
// AI WORKOUT GENERATOR
// ============================================================================
export interface GenerateWorkoutInput {
  goal: string; // e.g. "fat loss", "muscle gain", "general fitness"
  experienceLevel: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  equipment: string; // e.g. "full gym", "dumbbells only", "bodyweight"
  injuries?: string;
}

export interface AiWorkoutDay {
  dayLabel: string;
  exercises: { exerciseName: string; sets: number; reps: string; notes?: string }[];
}
export interface AiWorkoutPlan {
  title: string;
  days: AiWorkoutDay[];
}

export async function generateWorkoutPlanAI(input: GenerateWorkoutInput): Promise<ActionResult<AiWorkoutPlan>> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "You must be signed in to use the AI workout generator." };

  try {
    const plan = await generateJson<AiWorkoutPlan>(
      `Create a ${input.daysPerWeek}-day-per-week workout plan for a ${input.experienceLevel} trainee.
Goal: ${input.goal}. Available equipment: ${input.equipment}.
${input.injuries ? `Injuries/limitations to work around: ${input.injuries}.` : ""}

Return JSON exactly in this shape:
{
  "title": "short plan title",
  "days": [
    { "dayLabel": "Day 1 - Upper Body", "exercises": [ { "exerciseName": "Bench Press", "sets": 4, "reps": "8-10", "notes": "optional form cue" } ] }
  ]
}
Include ${input.daysPerWeek} day objects, each with 4-6 exercises. Keep exercise names standard gym terminology.`,
      "You are an experienced certified personal trainer who writes safe, effective, well-structured workout programs."
    );
    return { success: true, data: plan };
  } catch (err) {
    return { success: false, error: friendlyAiError(err) };
  }
}

// ============================================================================
// AI DIET GENERATOR
// ============================================================================
export interface GenerateDietInput {
  goal: string;
  dailyCalorieTarget: number;
  dietaryPreference: string; // e.g. "vegetarian", "no restrictions", "vegan"
  mealsPerDay: number;
}

export interface AiDietMeal {
  mealType: "breakfast" | "lunch" | "dinner" | "snacks";
  items: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
export interface AiDietPlan {
  title: string;
  dailyProteinG: number;
  dailyCarbsG: number;
  dailyFatG: number;
  meals: AiDietMeal[];
}

export async function generateDietPlanAI(input: GenerateDietInput): Promise<ActionResult<AiDietPlan>> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "You must be signed in to use the AI diet generator." };

  try {
    const plan = await generateJson<AiDietPlan>(
      `Create a daily diet plan targeting ${input.dailyCalorieTarget} kcal/day for someone whose goal is ${input.goal}.
Dietary preference: ${input.dietaryPreference}. Structure it across ${input.mealsPerDay} meals
(choose from breakfast, lunch, dinner, snacks). Use common, affordable, easy-to-prepare foods.

Return JSON exactly in this shape:
{
  "title": "short plan title",
  "dailyProteinG": number, "dailyCarbsG": number, "dailyFatG": number,
  "meals": [
    { "mealType": "breakfast", "items": "2 eggs, 1 toast, 1 banana", "calories": 400, "proteinG": 25, "carbsG": 40, "fatG": 12 }
  ]
}
Macro totals across meals should roughly add up to the calorie target.`,
      "You are a registered dietitian who writes practical, balanced meal plans using ordinary grocery-store food."
    );
    return { success: true, data: plan };
  } catch (err) {
    return { success: false, error: friendlyAiError(err) };
  }
}

// ============================================================================
// AI CHAT ASSISTANT (member-facing fitness Q&A)
// ============================================================================
export async function sendChatMessage(message: string): Promise<ActionResult<{ reply: string }>> {
  const profile = await getCurrentProfile();
  if (!profile?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const supabase = await createClient();

  const [{ data: history }, { data: memberDetails }] = await Promise.all([
    supabase.from("ai_chat_messages").select("role, content").eq("member_id", profile.id).order("created_at", { ascending: true }).limit(20),
    supabase.from("member_details").select("date_of_birth, gender, height_cm, weight_kg, medical_conditions").eq("profile_id", profile.id).single(),
  ]);

  await supabase.from("ai_chat_messages").insert({ gym_id: profile.gym_id, member_id: profile.id, role: "user", content: message });

  const bmi = memberDetails?.weight_kg && memberDetails?.height_cm ? calculateBmi(memberDetails.weight_kg, memberDetails.height_cm) : null;
  const context = [
    memberDetails?.gender ? `Gender: ${memberDetails.gender}` : null,
    memberDetails?.weight_kg ? `Weight: ${memberDetails.weight_kg}kg` : null,
    memberDetails?.height_cm ? `Height: ${memberDetails.height_cm}cm` : null,
    bmi ? `BMI: ${bmi}` : null,
    memberDetails?.medical_conditions ? `Medical notes: ${memberDetails.medical_conditions}` : null,
  ].filter(Boolean).join(". ");

  const conversationSoFar = (history ?? []).map((m) => `${m.role === "user" ? "Member" : "Assistant"}: ${m.content}`).join("\n");

  try {
    const reply = await generateText(
      `${conversationSoFar}\nMember: ${message}\nAssistant:`,
      `You are ATP Fitness's in-app fitness assistant, embedded inside a gym management app. You help members with
general fitness, nutrition, and workout questions. Member context: ${context || "not provided"}.
Keep replies concise (under 150 words), practical, and encouraging. You are not a doctor — for injury,
pain, or medical symptoms, tell them to consult a physician or their trainer instead of self-treating.
Never provide specific medication or dosage advice.`,
      600
    );

    await supabase.from("ai_chat_messages").insert({ gym_id: profile.gym_id, member_id: profile.id, role: "assistant", content: reply });
    return { success: true, data: { reply } };
  } catch (err) {
    return { success: false, error: friendlyAiError(err) };
  }
}

export async function getChatHistory() {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("ai_chat_messages").select("*").eq("member_id", profile.id).order("created_at", { ascending: true });
  return data ?? [];
}

// ============================================================================
// MEMBER RISK ANALYSIS / CANCELLATION PREDICTION
// Rule-based scoring on real behavioral signals (attendance trend, payment
// status, expiry proximity) — the AI is used only to write the narrative
// explanation, never to invent the underlying numbers.
// ============================================================================
interface RiskFactor { label: string; detail: string }

function scoreMember(params: {
  visitsLast30Days: number;
  visitsPrevious30Days: number;
  daysUntilExpiry: number;
  paymentStatus: string;
}): { score: number; factors: RiskFactor[] } {
  let score = 0;
  const factors: RiskFactor[] = [];

  const visitDrop = params.visitsPrevious30Days > 0 ? 1 - params.visitsLast30Days / params.visitsPrevious30Days : 0;
  if (params.visitsLast30Days === 0 && params.visitsPrevious30Days > 0) {
    score += 40;
    factors.push({ label: "No visits in 30 days", detail: "Was active before, hasn't checked in recently." });
  } else if (visitDrop > 0.5) {
    score += 25;
    factors.push({ label: "Attendance dropping", detail: `Visits down ${Math.round(visitDrop * 100)}% vs. the prior month.` });
  }

  if (params.daysUntilExpiry <= 7 && params.daysUntilExpiry >= 0) {
    score += 20;
    factors.push({ label: "Membership expiring soon", detail: `${params.daysUntilExpiry} day(s) left.` });
  } else if (params.daysUntilExpiry < 0) {
    score += 30;
    factors.push({ label: "Membership expired", detail: `Expired ${Math.abs(params.daysUntilExpiry)} day(s) ago.` });
  }

  if (params.paymentStatus === "pending" || params.paymentStatus === "partial") {
    score += 15;
    factors.push({ label: "Outstanding payment", detail: `Payment status: ${params.paymentStatus}.` });
  }

  return { score: Math.min(100, score), factors };
}

function riskLevelFor(score: number): RiskLevel {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export async function computeRiskScores(): Promise<ActionResult<{ analyzed: number; highRisk: number }>> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (err) {
    return { success: false, error: err instanceof PermissionError ? err.message : "Not authorized." };
  }
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("members_overview")
    .select("profile_id, full_name, end_date, payment_status, status")
    .eq("gym_id", actor.gym_id)
    .neq("status", "cancelled");

  if (!members?.length) return { success: true, data: { analyzed: 0, highRisk: 0 } };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  const { data: recentAttendance } = await admin
    .from("attendance_records")
    .select("member_id, check_in_at")
    .eq("gym_id", actor.gym_id)
    .gte("check_in_at", sixtyDaysAgo);

  const today = new Date();
  let highRiskCount = 0;
  const rows: { member_id: string; gym_id: string; risk_score: number; risk_level: RiskLevel; factors: RiskFactor[] }[] = [];

  for (const member of members) {
    const visits = (recentAttendance ?? []).filter((a) => a.member_id === member.profile_id);
    const visitsLast30Days = visits.filter((v) => v.check_in_at >= thirtyDaysAgo).length;
    const visitsPrevious30Days = visits.filter((v) => v.check_in_at < thirtyDaysAgo).length;
    const daysUntilExpiry = member.end_date
      ? Math.round((new Date(member.end_date).getTime() - today.getTime()) / 86400000)
      : 999;

    const { score, factors } = scoreMember({
      visitsLast30Days,
      visitsPrevious30Days,
      daysUntilExpiry,
      paymentStatus: member.payment_status ?? "paid",
    });

    const level = riskLevelFor(score);
    if (level === "high") highRiskCount++;
    rows.push({ member_id: member.profile_id, gym_id: actor.gym_id, risk_score: score, risk_level: level, factors });
  }

  // AI narrative only for the top 5 highest-risk members — keeps this fast and cheap.
  const narratives = new Map<string, string>();
  const top5 = [...rows].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5).filter((r) => r.risk_level !== "low");
  if (top5.length > 0) {
    try {
      const summaryInput = top5
        .map((r) => {
          const name = members.find((m) => m.profile_id === r.member_id)?.full_name;
          return `${name}: ${r.factors.map((f) => f.label).join(", ")}`;
        })
        .join("\n");
      const narrative = await generateText(
        `For each member below, write one short (max 20 words) actionable note for staff on how to re-engage them:\n${summaryInput}\n\nFormat: "Name: note" on each line.`,
        "You are a gym retention specialist giving brief, specific, actionable staff advice."
      );
      for (const line of narrative.split("\n")) {
        const [name, ...rest] = line.split(":");
        if (name && rest.length) narratives.set(name.trim(), rest.join(":").trim());
      }
    } catch {
      // Narrative is a nice-to-have — never block score computation on it.
    }
  }

  for (const row of rows) {
    const name = members.find((m) => m.profile_id === row.member_id)?.full_name ?? "";
    await admin.from("member_risk_scores").upsert({
      member_id: row.member_id,
      gym_id: row.gym_id,
      risk_score: row.risk_score,
      risk_level: row.risk_level,
      factors: row.factors,
      ai_narrative: narratives.get(name) ?? null,
      computed_at: new Date().toISOString(),
    });
  }

  return { success: true, data: { analyzed: rows.length, highRisk: highRiskCount } };
}

export async function getRiskScores() {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch {
    return [];
  }
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_risk_scores")
    .select("*, profiles:member_id(full_name, avatar_url)")
    .eq("gym_id", actor.gym_id)
    .order("risk_score", { ascending: false });
  return data ?? [];
}

// ============================================================================
// REVENUE FORECAST — real trend computed from payment history; AI writes
// only the narrative interpretation, not the numbers.
// ============================================================================
export async function computeRevenueForecast(): Promise<ActionResult<{ months: { month: string; revenue: number; isForecast: boolean }[]; narrative: string | null }>> {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch (err) {
    return { success: false, error: err instanceof PermissionError ? err.message : "Not authorized." };
  }
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return { success: false, error: "Your account isn't linked to a gym." };

  const admin = createAdminClient();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: payments } = await admin
    .from("payments")
    .select("total_amount, created_at")
    .eq("gym_id", actor.gym_id)
    .gte("created_at", sixMonthsAgo.toISOString());

  const monthlyTotals = new Map<string, number>();
  for (const p of payments ?? []) {
    const key = p.created_at.slice(0, 7); // YYYY-MM
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + p.total_amount);
  }

  const sortedMonths = [...monthlyTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const values = sortedMonths.map(([, v]) => v);

  // Simple linear regression over the observed months to project the next 3.
  const n = values.length;
  let projected: number[] = [];
  if (n >= 2) {
    const xs = values.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = values.reduce((a, b) => a + b, 0) / n;
    const slope =
      xs.reduce((sum, x, i) => sum + (x - meanX) * ((values[i] ?? 0) - meanY), 0) /
      (xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) || 1);
    const intercept = meanY - slope * meanX;
    projected = [n, n + 1, n + 2].map((x) => Math.max(0, Math.round(intercept + slope * x)));
  } else {
    projected = [values[0] ?? 0, values[0] ?? 0, values[0] ?? 0];
  }

  const result: { month: string; revenue: number; isForecast: boolean }[] = sortedMonths.map(([month, revenue]) => ({
    month,
    revenue: Math.round(revenue),
    isForecast: false,
  }));

  const lastMonthKey = sortedMonths.length ? sortedMonths[sortedMonths.length - 1]?.[0] : undefined;
  const lastMonth = lastMonthKey ? new Date(`${lastMonthKey}-01`) : new Date();

  for (let i = 0; i < 3; i++) {
    const d = new Date(lastMonth);
    d.setMonth(d.getMonth() + i + 1);
    const monthKey = d.toISOString().slice(0, 7);
    result.push({ month: monthKey, revenue: projected[i] ?? 0, isForecast: true });

    await admin.from("revenue_forecasts").upsert(
      {
        gym_id: actor.gym_id,
        forecast_month: `${monthKey}-01`,
        projected_revenue: projected[i] ?? 0,
        confidence: n >= 4 ? "medium" : "low",
        computed_at: new Date().toISOString(),
      },
      { onConflict: "gym_id,forecast_month" }
    );
  }

  let narrative: string | null = null;
  try {
    narrative = await generateText(
      `Historical monthly revenue: ${sortedMonths.map(([m, v]) => `${m}: ₹${Math.round(v)}`).join(", ")}.
Projected next 3 months (linear trend): ${projected.map((v, i) => `+${i + 1}mo: ₹${v}`).join(", ")}.
Write a 2-3 sentence plain-English summary of the trend for a gym owner, noting any risk or opportunity.`,
      "You are a small-business financial analyst. Be concrete and avoid generic filler."
    );
  } catch {
    // Narrative is optional; the numbers above are already real and useful without it.
  }

  return { success: true, data: { months: result, narrative } };
}

export async function getLatestForecast() {
  try {
    await requireRole("gym_owner", "super_admin");
  } catch {
    return [];
  }
  const actor = await getCurrentProfile();
  if (!actor?.gym_id) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("revenue_forecasts")
    .select("*")
    .eq("gym_id", actor.gym_id)
    .order("forecast_month", { ascending: true });
  return data ?? [];
}
