import type { SupabaseClient } from "@supabase/supabase-js";

type Factor = { status?: string | null };

export function needsMfaChallenge(currentLevel: string | null | undefined, factors: Factor[]) {
  return currentLevel !== "aal2" && factors.some(factor => factor.status === "verified");
}

export async function getMfaGateState(supabase: SupabaseClient) {
  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (assuranceError) throw assuranceError;
  if (factorsError) throw factorsError;

  const verifiedFactors = (factors.all ?? []).filter(factor => factor.status === "verified");
  return {
    currentLevel: assurance.currentLevel,
    hasVerifiedFactor: verifiedFactors.length > 0,
    requiresChallenge: needsMfaChallenge(assurance.currentLevel, verifiedFactors),
  };
}
