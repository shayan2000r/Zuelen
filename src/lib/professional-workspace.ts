import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import type { AccountantListingSubscription, AccountantProfile } from "@/lib/accountants";

export const ACTIVE_ACCOUNTANT_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);
export const DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES = new Set(["active", "trialing"]);

export async function getProfessionalWorkspace(requireProfile = true) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in?next=/professional");

  const supabase = await createClient();
  const { data: profileData, error: profileError } = await supabase
    .from("accountant_profiles")
    .select("*")
    .eq("user_id", workspace.userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const profile = profileData as AccountantProfile | null;
  if (requireProfile && !profile) redirect("/professional");

  let subscription: AccountantListingSubscription | null = null;
  if (profile) {
    const { data, error } = await supabase
      .from("accountant_listing_subscriptions")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    subscription = data as AccountantListingSubscription | null;
  }

  return { workspace, supabase, profile, subscription };
}

export function accountantSubscriptionStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "trialing": return "Free Trial";
    case "active": return "Active";
    case "past_due": return "Payment issue";
    case "canceled": return "Cancelled";
    case "incomplete": return "Incomplete";
    case "unpaid": return "Unpaid";
    default: return status ? status.replaceAll("_", " ").replace(/^./, value => value.toUpperCase()) : "Not started";
  }
}

export function accountantApprovalStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "approved": return "Approved";
    case "pending": return "Pending review";
    case "rejected": return "Changes required";
    default: return "Draft";
  }
}

export function accountantTrialDaysLeft(value: string | null | undefined) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}
