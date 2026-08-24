"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountantPriceId, normalizeAccountantTier, normalizeWebsite } from "@/lib/accountants";
import { stripeGet, stripePost } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function list(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string").map(value => value.trim()).filter(Boolean);
}

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || "accountant";
}

function imageExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

async function authenticatedProfileContext() {
  const workspace = await getWorkspace();
  const userId = workspace.userId;
  if (!workspace.authenticated || !userId) redirect("/sign-in?next=/professional");
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("accountant_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return { workspace, userId, supabase, profile };
}

export async function saveAccountantProfileAction(formData: FormData) {
  const { userId, supabase, profile } = await authenticatedProfileContext();
  const fullName = text(formData, "full_name");
  const professionalTitle = text(formData, "professional_title");
  const email = text(formData, "email");
  const yearsRaw = text(formData, "years_experience");
  const yearsExperience = yearsRaw ? Number.parseInt(yearsRaw, 10) : null;
  if (fullName.length < 2 || professionalTitle.length < 2 || !email.includes("@")) {
    throw new Error("Name, professional title and a valid contact email are required.");
  }
  if (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) {
    throw new Error("Years of experience must be between 0 and 80.");
  }

  let photoUrl = profile?.photo_url ?? null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) throw new Error("Profile photo must be smaller than 5 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("Use a JPG, PNG or WebP profile photo.");
    const path = `${userId}/profile-${Date.now()}.${imageExtension(photo)}`;
    const { error: uploadError } = await supabase.storage.from("accountant-profiles").upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    photoUrl = supabase.storage.from("accountant-profiles").getPublicUrl(path).data.publicUrl;
  }

  let slug = profile?.slug as string | undefined;
  if (!slug) {
    const base = slugify(text(formData, "firm_name") || fullName);
    // The suffix avoids collisions with pending/private profiles that RLS intentionally hides.
    slug = `${base}-${userId.replace(/-/g, "").slice(0, 8)}`;
  }

  const payload = {
    user_id: userId,
    slug,
    full_name: fullName,
    firm_name: text(formData, "firm_name") || null,
    professional_title: professionalTitle,
    bio: text(formData, "bio") || null,
    location: text(formData, "location") || "Luxembourg",
    languages: list(formData, "languages"),
    specialties: list(formData, "specialties"),
    business_types: list(formData, "business_types"),
    email,
    phone: text(formData, "phone") || null,
    website: normalizeWebsite(text(formData, "website")),
    portfolio_url: normalizeWebsite(text(formData, "portfolio_url")),
    qualifications: text(formData, "qualifications") || null,
    client_references: text(formData, "client_references") || null,
    years_experience: yearsExperience,
    photo_url: photoUrl,
    accepting_new_clients: formData.get("accepting_new_clients") === "on",
    works_remotely: formData.get("works_remotely") === "on",
    works_in_person: formData.get("works_in_person") === "on",
  };

  const query = profile
    ? supabase.from("accountant_profiles").update(payload).eq("id", profile.id).eq("user_id", userId)
    : supabase.from("accountant_profiles").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/professional");
  revalidatePath("/accountants/manage");
  revalidatePath("/app/accountants");
  revalidatePath("/accountants/directory");
  const returnTo = safeReturnPath(text(formData, "return_to"));
  redirect(returnTo || "/accountants/manage?saved=1");
}

export async function startAccountantTrialAction(formData: FormData) {
  const { workspace, profile, supabase } = await authenticatedProfileContext();
  if (!profile) throw new Error("Create your accountant profile before starting a subscription.");
  if (!profile.languages?.length || !profile.specialties?.length) throw new Error("Add at least one language and specialty before starting your subscription.");
  const tier = normalizeAccountantTier(formData.get("tier"));
  const price = accountantPriceId(tier);
  const { data: subscription, error } = await supabase.from("accountant_listing_subscriptions").select("*").eq("profile_id", profile.id).maybeSingle();
  if (error) throw new Error(error.message);

  if (subscription?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(subscription.status)) {
    if (subscription.tier === tier) return createAccountantPortalAction();
    const stripeSubscription = await stripeGet(`/subscriptions/${encodeURIComponent(subscription.stripe_subscription_id)}`);
    const itemId = stripeSubscription?.items?.data?.[0]?.id;
    if (!itemId) throw new Error("Stripe did not return the current accountant subscription item.");
    await stripePost(`/subscriptions/${encodeURIComponent(subscription.stripe_subscription_id)}`, {
      "items[0][id]": itemId,
      "items[0][price]": price,
      proration_behavior: "create_prorations",
      "metadata[kind]": "accountant_listing",
      "metadata[accountant_profile_id]": profile.id,
      "metadata[tier]": tier,
    });
    revalidatePath("/accountants/manage");
    revalidatePath("/accountants/directory");
    redirect(`/accountants/manage?plan=${tier}`);
  }

  const params: Record<string, string | number | boolean | null | undefined> = {
    mode: "subscription",
    success_url: `${APP_URL}/accountants/manage?checkout=success`,
    cancel_url: `${APP_URL}/professional?step=3&checkout=cancelled`,
    "line_items[0][price]": price,
    "line_items[0][quantity]": 1,
    client_reference_id: profile.id,
    integration_identifier: "zuelen_accountant_kmtrqvps",
    "metadata[kind]": "accountant_listing",
    "metadata[accountant_profile_id]": profile.id,
    "metadata[tier]": tier,
    "subscription_data[metadata][kind]": "accountant_listing",
    "subscription_data[metadata][accountant_profile_id]": profile.id,
    "subscription_data[metadata][tier]": tier,
    payment_method_collection: "always",
    billing_address_collection: "auto",
    "tax_id_collection[enabled]": true,
  };
  // The free trial is deliberately one-time. A canceled profile can resubscribe,
  // but it does not receive another 30 free days.
  if (!subscription?.trial_end) params["subscription_data[trial_period_days]"] = 30;
  if (subscription?.stripe_customer_id) params.customer = subscription.stripe_customer_id;
  else if (workspace.email) params.customer_email = workspace.email;

  const session = await stripePost("/checkout/sessions", params);
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(String(session.url));
}

export async function createAccountantPortalAction() {
  const { profile, supabase } = await authenticatedProfileContext();
  if (!profile) throw new Error("No accountant profile exists yet.");
  const { data: subscription, error } = await supabase.from("accountant_listing_subscriptions").select("stripe_customer_id").eq("profile_id", profile.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!subscription?.stripe_customer_id) throw new Error("No Stripe billing profile exists yet.");
  const session = await stripePost("/billing_portal/sessions", {
    customer: subscription.stripe_customer_id,
    return_url: `${APP_URL}/accountants/manage`,
  });
  if (!session.url) throw new Error("Stripe did not return a billing portal URL.");
  redirect(String(session.url));
}
