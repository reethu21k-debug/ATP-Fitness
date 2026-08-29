import { createAdminClient } from "@/lib/supabase/server";

// Public marketing site is unauthenticated, so this reads via the admin
// client (service role, bypasses RLS) rather than the normal request-scoped
// client used everywhere else in the dashboard -- there's no logged-in user
// whose tenant/gym context RLS could scope this to. Only non-sensitive,
// already-public-facing fields are selected.

export interface PublicPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string | null;
  periodLabel: string;
  featured: boolean;
}

function periodLabel(days: number) {
  if (days === 30) return "/month";
  if (days === 365) return "/year";
  if (days % 30 === 0) return `/${days / 30} months`;
  return `/${days} days`;
}

export async function getPublicMembershipPlans(): Promise<PublicPlan[]> {
  const admin = createAdminClient();

  // Single-gym marketing site: this reads the (one) active gym's plans.
  // If this codebase ever serves multiple gyms' public sites from one
  // deployment, swap this lookup for an env var or a route param instead.
  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!gym) return [];

  const { data: plans } = await admin
    .from("membership_plans")
    .select("id, name, price, duration_days, description")
    .eq("gym_id", gym.id)
    .eq("is_active", true)
    .order("price", { ascending: true });

  const rows = plans ?? [];
  // No admin-editable "featured" flag exists yet -- highlight the
  // middle-priced plan as a reasonable default when there are 3+ tiers.
  const featuredIndex = rows.length >= 3 ? Math.floor(rows.length / 2) : -1;

  return rows.map((p, i) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    durationDays: p.duration_days,
    description: p.description,
    periodLabel: periodLabel(p.duration_days),
    featured: i === featuredIndex,
  }));
}