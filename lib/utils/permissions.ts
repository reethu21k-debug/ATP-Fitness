import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export class PermissionError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "PermissionError";
  }
}

/** Throws if the current session's role can't perform `action` on `resource`. */
export async function requirePermission(resource: string, action: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    p_resource: resource,
    p_action: action,
  });
  if (error || !data) throw new PermissionError();
}

/** Throws unless the current user's role is one of `roles`. */
export async function requireRole(...roles: AppRole[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new PermissionError("Not authenticated.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !roles.includes(profile.role as AppRole)) {
    throw new PermissionError();
  }
  return profile;
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}
