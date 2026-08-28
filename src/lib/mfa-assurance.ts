import type { SupabaseClient } from "@supabase/supabase-js";

type Factor = { status?: string | null };

export function needsMfaChallenge(currentLevel: string | null | undefined, factors: Factor[]) {
  return currentLevel !== "aal2" && factors.some(factor => factor.status === "verified");
}

export async function currentUserRequiresMfa(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("current_user_requires_mfa");
  if (error) throw error;
  return data === true;
}
