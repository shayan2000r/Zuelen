import { redirect } from "next/navigation";
import { AccountantOnboarding } from "@/components/accountant-onboarding";
import { accountantStripeConfigured, type AccountantListingSubscription, type AccountantProfile } from "@/lib/accountants";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Params = { step?: string };

export default async function ProfessionalPage({ searchParams }: { searchParams: Promise<Params> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in?type=accountant");
  const params = await searchParams;
  const supabase = await createClient();
  const { data: profileData, error: profileError } = await supabase.from("accountant_profiles").select("*").eq("user_id", workspace.userId).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  const profile = profileData as AccountantProfile | null;

  if (profile && params.step !== "3") redirect("/accountants/manage");

  let subscription: AccountantListingSubscription | null = null;
  if (profile) {
    const { data, error } = await supabase.from("accountant_listing_subscriptions").select("*").eq("profile_id", profile.id).maybeSingle();
    if (error) throw new Error(error.message);
    subscription = data as AccountantListingSubscription | null;
  }

  return <AccountantOnboarding
    email={workspace.email}
    profile={profile}
    subscription={subscription}
    stripeConfigured={accountantStripeConfigured()}
    initialStep={profile && params.step === "3" ? 3 : 1}
  />;
}
