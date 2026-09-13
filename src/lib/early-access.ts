import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type EarlyAccessLocale = "en" | "fr";

export function normalizeEarlyAccessEmail(email: string) {
  return email.trim().toLowerCase();
}

export function earlyAccessPublicUrl(locale: EarlyAccessLocale = "en") {
  return locale === "fr"
    ? "https://zuelen.lu/acces-anticipe"
    : "https://zuelen.lu/en/early-access";
}

export async function isEarlyAccessAllowed(email: string | null | undefined) {
  if (!email) return false;
  const admin = createAdminClient();
  const normalized = normalizeEarlyAccessEmail(email);
  const { data, error } = await admin
    .from("early_access_allowed_emails")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function allowEarlyAccessEmail(
  email: string,
  source: "existing_user" | "waitlist_approval" | "manual" = "waitlist_approval",
) {
  const admin = createAdminClient();
  const normalized = normalizeEarlyAccessEmail(email);
  const { error } = await admin
    .from("early_access_allowed_emails")
    .upsert({ email: normalized, source }, { onConflict: "email" });
  if (error) throw new Error(error.message);
}

export async function markEarlyAccessActivated(email: string) {
  const admin = createAdminClient();
  const normalized = normalizeEarlyAccessEmail(email);
  const now = new Date().toISOString();
  const { error } = await admin
    .from("early_access_waitlist")
    .update({ status: "activated", activated_at: now, updated_at: now })
    .eq("email", normalized)
    .in("status", ["approved", "invited"]);
  if (error) throw new Error(error.message);
}
