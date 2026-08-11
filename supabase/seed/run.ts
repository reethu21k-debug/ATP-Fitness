/**
 * ATP Fitness — Demo seed script (Part 14)
 * ============================================================================
 * Populates ONE realistic multi-branch tenant end-to-end so a fresh Supabase
 * project can be explored immediately after `db:migrate`, without needing to
 * click through every registration form by hand first.
 *
 * This deliberately mirrors the REAL app code paths rather than inventing a
 * shortcut:
 *   - Auth users are created via `admin.auth.admin.createUser`, exactly like
 *     `createMember`/`registerGym`/`createStaff` do in the actual Server
 *     Actions — so the `handle_new_auth_user` trigger fires for real and
 *     every profile row is created the same way production traffic creates it.
 *   - Money, dates, and status fields follow the same conventions the app's
 *     own actions use (e.g. `is_current` on memberships, invoice/receipt
 *     numbers via the real `next_invoice_number`/`next_receipt_number` SQL
 *     functions, inventory quantity driven by the transactions ledger, never
 *     written directly).
 *
 * Usage:
 *   npm run db:seed
 *
 * Requires (same vars the app itself needs):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Safe to re-run: it looks for an existing "ATP Fitness Demo" tenant by slug first
 * and exits early instead of creating duplicates. To start fresh, delete the
 * tenant row in Supabase (cascades through everything) and re-run.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, AppRole, Gender, BloodGroup, PaymentMethod, LeadStatus, LeadSource, InventoryCategory, AttendanceRecord } from "../../types/database";

// ----------------------------------------------------------------------------
// Env loading — no dotenv dependency; Next.js loads .env.local itself, but a
// standalone tsx script needs to read it manually.
// ----------------------------------------------------------------------------
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function loadEnvFile(filename: string) {
  const path = join(process.cwd(), filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "\n❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "   Set them in .env.local (see .env.example) before running `npm run db:seed`.\n"
  );
  process.exit(1);
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------
const DEMO_PASSWORD = "AtpFitnessDemo#2026";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function daysAgo(days: number) {
  return daysFromNow(-days);
}
function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function log(step: string) {
  console.log(`→ ${step}`);
}
function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string, err?: unknown): never {
  console.error(`\n❌ ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

/** Create (or fetch, if already exists) an auth user + profile, exactly the
 * way createMember/createStaff/registerGym do it in the real app. */
async function createUser(opts: {
  email: string;
  fullName: string;
  phone?: string;
  role: AppRole;
}) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: DEMO_PASSWORD,
    phone: opts.phone,
    email_confirm: true,
    user_metadata: { full_name: opts.fullName, role: opts.role },
  });

  if (error) {
    if (error.message?.includes("already been registered")) {
      // Re-run safety: look the user up by listing (admin API has no
      // get-by-email), fall back to profiles table by email.
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", opts.email)
        .single();
      if (existingProfile) return existingProfile.id;
    }
    fail(`Could not create auth user ${opts.email}`, error);
  }

  return created.user.id;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("\n🏋️  ATP Fitness demo seed — starting\n");

  // --------------------------------------------------------------------
  // 0. Idempotency check
  // --------------------------------------------------------------------
  log("Checking for an existing demo tenant");
  const { data: existingTenant } = await admin
    .from("tenants")
    .select("id, name")
    .eq("slug", "atp-fitness-demo")
    .maybeSingle();

  if (existingTenant) {
    console.log(
      `\n⚠️  A tenant with slug "atp-fitness-demo" already exists (id: ${existingTenant.id}).\n` +
        `   Seed already ran. To start fresh, delete that tenant row in Supabase\n` +
        `   (cascades through everything) and re-run "npm run db:seed".\n`
    );
    process.exit(0);
  }
  ok("No existing demo tenant — proceeding");

  // --------------------------------------------------------------------
  // 1. Owner + Tenant + two Gyms (multi-branch, per Part 13)
  // --------------------------------------------------------------------
  log("Creating gym owner account");
  const ownerId = await createUser({
    email: "owner@atpfitness-demo.in",
    fullName: "Rohan Mehta",
    phone: "+919810000001",
    role: "gym_owner",
  });
  ok(`Owner profile: ${ownerId}`);

  log("Creating tenant");
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({
      name: "Momentum Fitness",
      slug: "atp-fitness-demo",
      owner_id: ownerId,
      subscription_plan: "growth",
      subscription_status: "active",
      billing_email: "owner@atpfitness-demo.in",
      primary_color: "#6366F1",
    })
    .select("id")
    .single();
  if (tenantError || !tenant) fail("Could not create tenant", tenantError);
  ok(`Tenant: ${tenant.id}`);

  log("Creating gyms (main branch + second branch)");
  const { data: gymMain, error: gymMainError } = await admin
    .from("gyms")
    .insert({
      tenant_id: tenant.id,
      name: "Momentum Fitness — Koramangala",
      code: "KOR",
      address: "80 Ft Road, Koramangala 4th Block",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560034",
      phone: "+918041000001",
      email: "koramangala@atpfitness-demo.in",
      latitude: 12.9352,
      longitude: 77.6146,
      gps_checkin_radius_meters: 150,
      manager_id: ownerId,
      monthly_revenue_target: 500000,
    })
    .select("id")
    .single();
  if (gymMainError || !gymMain) fail("Could not create main gym", gymMainError);

  const { data: gymBranch, error: gymBranchError } = await admin
    .from("gyms")
    .insert({
      tenant_id: tenant.id,
      name: "Momentum Fitness — Indiranagar",
      code: "IND",
      address: "100 Feet Road, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560038",
      phone: "+918041000002",
      email: "indiranagar@atpfitness-demo.in",
      latitude: 12.9719,
      longitude: 77.6412,
      gps_checkin_radius_meters: 150,
      manager_id: ownerId,
      monthly_revenue_target: 350000,
    })
    .select("id")
    .single();
  if (gymBranchError || !gymBranch) fail("Could not create branch gym", gymBranchError);
  ok(`Gyms: ${gymMain.id} (Koramangala, primary), ${gymBranch.id} (Indiranagar)`);

  // Owner's active gym_id = main branch (branch switching from Part 13).
  await admin.from("profiles").update({ tenant_id: tenant.id, gym_id: gymMain.id }).eq("id", ownerId);

  const gymId = gymMain.id; // most demo data lives in the primary branch

  // --------------------------------------------------------------------
  // 2. Membership plans (seeded already by 0004 trigger — fetch them)
  // --------------------------------------------------------------------
  log("Fetching auto-seeded membership plans");
  const { data: plans } = await admin
    .from("membership_plans")
    .select("id, name, duration_days, price")
    .eq("gym_id", gymId)
    .order("duration_days");
  if (!plans || plans.length === 0) fail("Expected membership_plans to be auto-seeded by migration 0004, found none");
  ok(`${plans.length} plans available: ${plans.map((p) => p.name).join(", ")}`);

  // --------------------------------------------------------------------
  // 3. Staff — receptionist + 3 trainers
  // --------------------------------------------------------------------
  log("Creating receptionist");
  const receptionistId = await createUser({
    email: "reception@atpfitness-demo.in",
    fullName: "Ananya Rao",
    phone: "+919810000002",
    role: "receptionist",
  });
  await admin
    .from("profiles")
    .update({ tenant_id: tenant.id, gym_id: gymId, full_name: "Ananya Rao", phone: "+919810000002" })
    .eq("id", receptionistId);
  ok(`Receptionist: ${receptionistId}`);

  log("Creating trainers");
  const trainerNames = [
    { name: "Vikram Singh", email: "vikram.trainer@atpfitness-demo.in", phone: "+919810000003" },
    { name: "Priya Nair", email: "priya.trainer@atpfitness-demo.in", phone: "+919810000004" },
    { name: "Arjun Kapoor", email: "arjun.trainer@atpfitness-demo.in", phone: "+919810000005" },
  ];
  const trainerIds: string[] = [];
  for (const t of trainerNames) {
    const id = await createUser({ email: t.email, fullName: t.name, phone: t.phone, role: "trainer" });
    await admin
      .from("profiles")
      .update({ tenant_id: tenant.id, gym_id: gymId, full_name: t.name, phone: t.phone })
      .eq("id", id);
    trainerIds.push(id);
  }
  ok(`${trainerIds.length} trainers created`);

  // --------------------------------------------------------------------
  // 4. Staff salary config (payroll — Part 9)
  // --------------------------------------------------------------------
  log("Setting up payroll salary configs");
  await admin.from("staff_salary_config").insert([
    { staff_id: receptionistId, gym_id: gymId, base_salary: 25000, commission_rate: 1.5 },
    ...trainerIds.map((id) => ({
      staff_id: id,
      gym_id: gymId,
      base_salary: 35000,
      commission_rate: 5,
    })),
  ]);
  ok("Salary configs set");

  // --------------------------------------------------------------------
  // 5. Members — 25 members with varying membership states
  // --------------------------------------------------------------------
  log("Creating 25 members with realistic membership states");

  const firstNames = [
    "Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Sai", "Reyansh", "Arnav",
    "Diya", "Ananya", "Myra", "Sara", "Ira", "Anika", "Navya", "Riya",
    "Rohan", "Kavya", "Zoya", "Advik", "Neha", "Tara", "Dev", "Meera", "Yash",
  ];
  const lastNames = [
    "Sharma", "Verma", "Iyer", "Reddy", "Gupta", "Malhotra", "Chawla", "Bose",
    "Menon", "Pillai", "Chopra", "Bhatia", "Rao", "Desai", "Kulkarni",
  ];
  const genders: Gender[] = ["male", "female", "other"];
  const bloodGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  type MemberSeed = { id: string; status: "active" | "expiring_soon" | "expired" | "frozen"; joiningDaysAgo: number };
  const memberPlan: MemberSeed[] = [];
  // Distribution: 15 active (long remaining), 4 expiring within a week,
  // 4 expired recently, 2 frozen — gives every dashboard/report real variety.
  for (let i = 0; i < 25; i++) {
    let status: MemberSeed["status"];
    if (i < 15) status = "active";
    else if (i < 19) status = "expiring_soon";
    else if (i < 23) status = "expired";
    else status = "frozen";
    memberPlan.push({ id: "", status, joiningDaysAgo: Math.floor(randomBetween(10, 400)) });
  }

  const memberIds: string[] = [];
  for (let i = 0; i < 25; i++) {
    const first = firstNames[i]!;
    const last = pick(lastNames);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@atpfitness-demo.in`;
    const phone = `+9198100${String(10 + i).padStart(5, "0")}`;
    const id = await createUser({ email, fullName: `${first} ${last}`, phone, role: "member" });
    memberIds.push(id);
    memberPlan[i]!.id = id;

    const plan = pick(plans);
    const joinDate = daysAgo(memberPlan[i]!.joiningDaysAgo);
    const trainerId = pick(trainerIds);

    await admin
      .from("profiles")
      .update({ tenant_id: tenant.id, gym_id: gymId, full_name: `${first} ${last}`, phone })
      .eq("id", id);

    await admin.from("member_details").insert({
      profile_id: id,
      gym_id: gymId,
      date_of_birth: isoDate(daysAgo(Math.floor(randomBetween(18, 45)) * 365)),
      gender: pick(genders),
      address: `${100 + i} MG Road, Bengaluru`,
      emergency_contact_name: `${pick(firstNames)} ${pick(lastNames)}`,
      emergency_contact_phone: `+9198200${String(10 + i).padStart(5, "0")}`,
      blood_group: pick(bloodGroups),
      medical_conditions: i % 7 === 0 ? "Mild asthma — avoid high-intensity cardio without inhaler nearby" : null,
      height_cm: randomBetween(155, 190).toFixed(1),
      weight_kg: randomBetween(55, 95).toFixed(1),
      joining_date: isoDate(joinDate),
      assigned_trainer_id: trainerId,
      status:
        memberPlan[i]!.status === "frozen"
          ? "frozen"
          : memberPlan[i]!.status === "expired"
            ? "expired"
            : "active",
    });
  }
  ok(`${memberIds.length} members created with details`);

  // --------------------------------------------------------------------
  // 6. Memberships + Payments for each member (realistic invoice numbers)
  // --------------------------------------------------------------------
  log("Creating membership periods + payments (real invoice/receipt sequences)");
  const paymentMethods: PaymentMethod[] = ["cash", "upi", "card", "bank"];

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]!;
    const state = memberPlan[i]!;
    const plan = pick(plans);
    const trainerId = pick(trainerIds);

    let startDate: Date;
    let endDate: Date;
    switch (state.status) {
      case "active":
        startDate = daysAgo(Math.floor(randomBetween(5, 60)));
        endDate = daysFromNow(Math.floor(randomBetween(30, 300)));
        break;
      case "expiring_soon":
        startDate = daysAgo(plan.duration_days - Math.floor(randomBetween(1, 6)));
        endDate = daysFromNow(Math.floor(randomBetween(1, 6)));
        break;
      case "expired":
        startDate = daysAgo(plan.duration_days + Math.floor(randomBetween(5, 20)));
        endDate = daysAgo(Math.floor(randomBetween(1, 15)));
        break;
      case "frozen":
        startDate = daysAgo(60);
        endDate = daysFromNow(120);
        break;
    }

    const amount = Number(plan.price);
    const discount = i % 5 === 0 ? Math.round(amount * 0.1) : 0;
    const netAmount = amount - discount;

    const { data: membership, error: membershipError } = await admin
      .from("member_memberships")
      .insert({
        member_id: memberId,
        gym_id: gymId,
        plan_id: plan.id,
        start_date: isoDate(startDate),
        end_date: isoDate(endDate),
        amount,
        discount_amount: discount,
        amount_paid: netAmount,
        payment_status: "paid",
        trainer_id: trainerId,
        is_current: true,
        created_by: receptionistId,
      })
      .select("id")
      .single();
    if (membershipError || !membership) {
      console.warn(`  ⚠ Skipping payment for member ${i}: ${membershipError?.message}`);
      continue;
    }

    const { data: invoiceNum } = await admin.rpc("next_invoice_number", { p_gym_id: gymId });
    const { data: receiptNum } = await admin.rpc("next_receipt_number", { p_gym_id: gymId });
    const gstRate = 18;
    const gstAmount = Math.round(netAmount * (gstRate / 100));

    await admin.from("payments").insert({
      gym_id: gymId,
      member_id: memberId,
      membership_id: membership.id,
      amount: netAmount,
      gst_rate: gstRate,
      gst_amount: gstAmount,
      total_amount: netAmount + gstAmount,
      method: pick(paymentMethods),
      invoice_number: String(invoiceNum ?? `INV-${1000 + i}`),
      receipt_number: String(receiptNum ?? `RCT-${1000 + i}`),
      created_by: receptionistId,
      created_at: startDate.toISOString(),
    });
  }
  ok("Memberships + payments created");

  // --------------------------------------------------------------------
  // 7. Attendance — last 30 days of realistic check-ins for active members
  // --------------------------------------------------------------------
  log("Generating 30 days of attendance history");
  const activeMemberIds = memberPlan.filter((m) => m.status === "active" || m.status === "expiring_soon").map((m) => m.id);
  const attendanceRows: Partial<AttendanceRecord>[] = [];

  for (const memberId of activeMemberIds) {
    for (let dayOffset = 29; dayOffset >= 1; dayOffset--) {
      // Each member attends roughly every other day, weighted toward evenings.
      if (Math.random() > 0.55) continue;
      const day = daysAgo(dayOffset);
      const hour = Math.random() > 0.4 ? Math.floor(randomBetween(17, 21)) : Math.floor(randomBetween(6, 10));
      const checkIn = new Date(day);
      checkIn.setHours(hour, Math.floor(randomBetween(0, 59)), 0, 0);
      const durationMin = Math.floor(randomBetween(35, 95));
      const checkOut = new Date(checkIn.getTime() + durationMin * 60000);

      attendanceRows.push({
        gym_id: gymId,
        member_id: memberId,
        check_in_at: checkIn.toISOString(),
        check_out_at: checkOut.toISOString(),
        duration_minutes: durationMin,
        method: "qr",
        gps_verified: true,
      });
    }
  }
  // Batch insert in chunks of 200 to stay well under request size limits.
  for (let i = 0; i < attendanceRows.length; i += 200) {
    const chunk = attendanceRows.slice(i, i + 200);
    const { error } = await admin.from("attendance_records").insert(chunk);
    if (error) console.warn(`  ⚠ Attendance chunk insert warning: ${error.message}`);
  }
  ok(`${attendanceRows.length} attendance records created`);

  // --------------------------------------------------------------------
  // 8. Workout + Diet plans for a handful of members (trainer module)
  // --------------------------------------------------------------------
  log("Creating workout + diet plans for 10 members");
  const planMemberIds = activeMemberIds.slice(0, 10);
  for (const memberId of planMemberIds) {
    const trainerId = pick(trainerIds);
    const { data: workoutPlan } = await admin
      .from("workout_plans")
      .insert({
        gym_id: gymId,
        member_id: memberId,
        trainer_id: trainerId,
        title: "Strength & Conditioning — 4 Day Split",
        frequency: "weekly",
        start_date: isoDate(daysAgo(14)),
        notes: "Progressive overload; increase load 2.5–5% weekly if form holds.",
      })
      .select("id")
      .single();

    if (workoutPlan) {
      const dayLabels = ["Day 1 — Push", "Day 2 — Pull", "Day 3 — Legs", "Day 4 — Full Body"];
      for (let d = 0; d < dayLabels.length; d++) {
        const { data: workoutDay } = await admin
          .from("workout_days")
          .insert({ workout_plan_id: workoutPlan.id, day_label: dayLabels[d], day_order: d })
          .select("id")
          .single();
        if (workoutDay) {
          const exercises =
            d === 0
              ? [["Bench Press", 4, "6-8", 60], ["Overhead Press", 3, "8-10", 30], ["Tricep Pushdown", 3, "12-15", 20]]
              : d === 1
                ? [["Deadlift", 4, "5-6", 80], ["Lat Pulldown", 3, "10-12", 45], ["Barbell Row", 3, "8-10", 40]]
                : d === 2
                  ? [["Back Squat", 4, "6-8", 70], ["Leg Press", 3, "10-12", 120], ["Calf Raise", 3, "15-20", 40]]
                  : [["Kettlebell Swing", 3, "15", 16], ["Farmer's Carry", 3, "40m", 24], ["Plank", 3, "60s", 0]];
          await admin.from("workout_exercises").insert(
            exercises.map(([name, sets, reps, weight], idx) => ({
              workout_day_id: workoutDay.id,
              exercise_name: name as string,
              sets: sets as number,
              reps: reps as string,
              weight_kg: weight as number,
              order_index: idx,
            }))
          );
        }
      }
    }

    await admin.from("diet_plans").insert({
      gym_id: gymId,
      member_id: memberId,
      trainer_id: trainerId,
      title: "Lean Muscle — Moderate Carb Plan",
      start_date: isoDate(daysAgo(14)),
      daily_calorie_target: 2200,
      daily_protein_g: 150,
      daily_carbs_g: 220,
      daily_fat_g: 65,
      notes: "Adjust calories ±150 based on weekly weigh-in trend.",
    });

    // A few progress entries so charts have data.
    const progressRows = [21, 14, 7, 0].map((daysBack) => ({
      gym_id: gymId,
      member_id: memberId,
      recorded_at: isoDate(daysAgo(daysBack)),
      weight_kg: Number((randomBetween(65, 85) - daysBack * 0.05).toFixed(1)),
      body_fat_pct: Number(randomBetween(14, 24).toFixed(1)),
      chest_cm: Number(randomBetween(90, 110).toFixed(1)),
      waist_cm: Number(randomBetween(75, 95).toFixed(1)),
      hips_cm: Number(randomBetween(90, 105).toFixed(1)),
    }));
    await admin.from("member_progress").insert(progressRows);
  }
  ok("Workout/diet plans + progress history created for 10 members");

  // --------------------------------------------------------------------
  // 9. CRM leads — realistic pipeline spread
  // --------------------------------------------------------------------
  log("Creating CRM leads across the pipeline");
  const leadStatuses: LeadStatus[] = [
    "new", "new", "contacted", "contacted", "trial_scheduled", "trial_completed", "converted", "lost",
  ];
  const leadSources: LeadSource[] = ["walk_in", "referral", "online", "phone", "social"];
  for (let i = 0; i < 12; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const status = leadStatuses[i % leadStatuses.length]!;
    await admin.from("leads").insert({
      gym_id: gymId,
      name: `${first} ${last}`,
      phone: `+9198300${String(10 + i).padStart(5, "0")}`,
      email: `${first.toLowerCase()}.lead${i}@example.com`,
      source: pick(leadSources),
      status,
      interested_plan_id: pick(plans).id,
      assigned_to: receptionistId,
      follow_up_date: status === "converted" || status === "lost" ? null : isoDate(daysFromNow(Math.floor(randomBetween(0, 7)))),
      lost_reason: status === "lost" ? "Chose a gym closer to home" : null,
      notes: "Interested in group classes as well as personal training.",
      created_by: receptionistId,
    });
  }
  ok("12 leads created across the pipeline");

  // --------------------------------------------------------------------
  // 10. Inventory — equipment, supplements, accessories
  // --------------------------------------------------------------------
  log("Creating inventory items + stock transactions");
  const inventorySeed: Array<{
    name: string;
    category: InventoryCategory;
    unit: string;
    cost: number;
    sell: number;
    threshold: number;
    initialStock: number;
    expiryDaysFromNow?: number;
  }> = [
    { name: "Olympic Barbell 20kg", category: "equipment", unit: "piece", cost: 8500, sell: 0, threshold: 1, initialStock: 6 },
    { name: "Rubber Bumper Plates (Set)", category: "equipment", unit: "set", cost: 12000, sell: 0, threshold: 2, initialStock: 8 },
    { name: "Resistance Bands", category: "accessory", unit: "piece", cost: 250, sell: 500, threshold: 10, initialStock: 40 },
    { name: "Whey Protein 1kg — Chocolate", category: "supplement", unit: "jar", cost: 1600, sell: 2500, threshold: 8, initialStock: 4, expiryDaysFromNow: 45 },
    { name: "Whey Protein 1kg — Vanilla", category: "supplement", unit: "jar", cost: 1600, sell: 2500, threshold: 8, initialStock: 22, expiryDaysFromNow: 300 },
    { name: "BCAA 300g", category: "supplement", unit: "jar", cost: 900, sell: 1400, threshold: 5, initialStock: 3, expiryDaysFromNow: 20 },
    { name: "Creatine Monohydrate 250g", category: "supplement", unit: "jar", cost: 700, sell: 1100, threshold: 6, initialStock: 15, expiryDaysFromNow: 365 },
    { name: "Gym Towels", category: "accessory", unit: "piece", cost: 120, sell: 200, threshold: 20, initialStock: 60 },
    { name: "Shaker Bottles", category: "accessory", unit: "piece", cost: 150, sell: 300, threshold: 15, initialStock: 5 },
    { name: "Yoga Mats", category: "equipment", unit: "piece", cost: 800, sell: 0, threshold: 5, initialStock: 18 },
  ];

  for (const item of inventorySeed) {
    const { data: created, error } = await admin
      .from("inventory_items")
      .insert({
        gym_id: gymId,
        name: item.name,
        category: item.category,
        quantity: 0, // set via transaction below, never written directly
        unit: item.unit,
        cost_price: item.cost,
        sell_price: item.sell || null,
        low_stock_threshold: item.threshold,
        expiry_date: item.expiryDaysFromNow != null ? isoDate(daysFromNow(item.expiryDaysFromNow)) : null,
        supplier: "FitSupply Distributors",
      })
      .select("id")
      .single();
    if (error || !created) {
      console.warn(`  ⚠ Skipping inventory item ${item.name}: ${error?.message}`);
      continue;
    }
    await admin.from("inventory_transactions").insert({
      item_id: created.id,
      gym_id: gymId,
      type: "restock",
      quantity_change: item.initialStock,
      notes: "Initial stock (seed)",
      created_by: receptionistId,
    });
  }
  ok(`${inventorySeed.length} inventory items created with initial stock`);

  // --------------------------------------------------------------------
  // 11. Support ticket (Part 12 — super admin / tenant thread)
  // --------------------------------------------------------------------
  log("Creating a sample support ticket");
  const { data: ticket } = await admin
    .from("support_tickets")
    .insert({
      tenant_id: tenant.id,
      created_by: ownerId,
      subject: "Question about WhatsApp template approval",
      description: "Our renewal reminder WhatsApp messages stopped sending — do we need to re-verify our template with Meta?",
      status: "open",
      priority: "normal",
    })
    .select("id")
    .single();
  if (ticket) {
    await admin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_id: ownerId,
      message: "Started seeing failures in the delivery log since yesterday morning.",
      is_internal_note: false,
    });
  }
  ok("Support ticket created");

  // --------------------------------------------------------------------
  // Done
  // --------------------------------------------------------------------
  console.log("\n✅ Seed complete!\n");
  console.log("Demo login credentials (all share the same password):");
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  console.log(`  Gym Owner:     owner@atpfitness-demo.in`);
  console.log(`  Receptionist:  reception@atpfitness-demo.in`);
  console.log(`  Trainer:       vikram.trainer@atpfitness-demo.in`);
  console.log(`  Member:        ${firstNames[0]!.toLowerCase()}.${pick(lastNames).toLowerCase()}0@atpfitness-demo.in (see console output above for exact emails)\n`);
  console.log("Tenant: Momentum Fitness (2 branches: Koramangala, Indiranagar)");
  console.log(`  Members: ${memberIds.length} | Trainers: ${trainerIds.length} | Leads: 12 | Inventory items: ${inventorySeed.length}\n`);
}

main().catch((err) => {
  console.error("\n❌ Seed script failed with an unexpected error:\n");
  console.error(err);
  process.exit(1);
});
