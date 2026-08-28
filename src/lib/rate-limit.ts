import "server-only";

import type { createClient } from "@/lib/supabase/server";

export type SecurityRateLimitAction = "bank_import" | "checkout" | "copilot" | "document_extract";

export class SecurityRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests. Please wait a moment and try again.");
    this.name = "SecurityRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function assertActionRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: SecurityRateLimitAction,
) {
  const { data, error } = await supabase.rpc("consume_security_rate_limit", { p_action: action });
  if (error) throw new Error("Security rate-limit check failed.");
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.allowed !== true) {
    throw new SecurityRateLimitError(Math.max(1, Number(result?.retry_after_seconds ?? 60)));
  }
}

export function localizedRateLimitMessage(locale: "en" | "fr", retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return locale === "fr"
    ? `Trop de demandes rapprochées. Réessayez dans environ ${minutes} minute${minutes === 1 ? "" : "s"}.`
    : `Too many requests in a short period. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
