"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountantPriceId, normalizeAccountantTier, normalizeWebsite } from "@/lib/accountants";
import { stripePost } from "@/lib/stripe";
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
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "accountant";
}

function imageExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function authenticatedProfileContext() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in?next=/accountants/manage");
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("accountant_profiles").select("*").eq("user_id", workspace.userId).maybeSingle();
  if (error) throw new Error(error.message);
  return { workspace, supabase, profile };
}

export async function saveAccountantProfileAction(formData: FormData) {
  const { workspace, supabase, profile } = await authenticatedProfileContext();
  const fullName = text(formData, "full_name");
  const professionalTitle = text(formData, "professional_title");
  const email = text(formData, "email");
  if (fullName.length < 2 || professionalTitle.length < 2 || !email.includes("@")) {
    throw new Error("Name, professional title and a valid contact email are required.");
  }

  let photoUrl = profile?.photo_url ?? null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) throw new Error("Profile photo must be smaller than 5 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("Use a JPG, PNG or WebP profile photo.");
    const path = `${workspace.userId}/profile-${Date.now()}.${imageExtension(photo)}`;
    const { error: uploadError } = await supabase.storage.from("accountant-profiles").upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    photoUrl = supabase.storage.from("accountant-profiles").getPublicUrl(path).data.publicUrl;
  }

  let slug = profile?.slug as string | undefined;
  if (!slug) {
    const base = slugify(text(formData, "firm_name") || fullName);
    const { data: collision } = await supabase.from("accountant_profiles").select("id").eq("slug", base).maybeSingle();
    slug = collision ? `${base}-${workspace.userId.slice(0, 6)}` : base;
  }

  const payload = {
    user_id: workspace.userId,
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
    photo_url: photoUrl,
    accepting_new_clients: formData.get("accepting_new_clients") === "on",
    works_remotely: formData.get("works_remotely") === "on",
    works_in_person: formData.get("works_in_person") === "on",
  };

  const query = profile
    ? supabase.from("accountant_profiles").update(payload).eq("id", profile.id).eq("user_id", workspace.userId)
    : supabase.from("accountant_profiles").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/accountants/manage");
  revalidatePath("/app/accountants");
  redirect("/accountants/manage?saved=1");
}

export async function startAccountantTrialAction(formData: FormData) {
  const { workspace, profile, supabase } = await authenticatedProfileContext();
  if (!profile) throw new Error("Create your accountant profile before starting a trial.");
  if (!profile.languages?.length || !profile.specialties?.length) throw new Error("Add at least one language and specialty before starting your trial.");
  const tier = normalizeAccountantTier(formData.get("tier"));
  const price = accountantPriceId(tier);
  const { data: subscription, error } = await supabase.from("accountant_listing_subscriptions").select("*").eq("profile_id", profile.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (subscription?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(subscription.status)) return createAccountantPortalAction();

  const params: Record<string, string | number | boolean | null | undefined> = {
    mode: "subscription",
    success_url: `${APP_URL}/accountants/manage?checkout=success`,
    cancel_url: `${APP_URL}/accountants/manage?checkout=cancelled`,
    "line_items[0][price]": price,
    "line_items[0][quantity]": 1,
    client_reference_id: profile.id,
    "metadata[kind]": "accountant_listing",
    "metadata[accountant_profile_id]": profile.id,
    "metadata[tier]": tier,
    "subscription_data[metadata][kind]": "accountant_listing",
    "subscription_data[metadata][accountant_profile_id]": profile.id,
    "subscription_data[metadata][tier]": tier,
    "subscription_data[trial_period_days]": 30,
    payment_method_collection: "always",
    billing_address_collection: "auto",
    "tax_id_collection[enabled]": true,
  };
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