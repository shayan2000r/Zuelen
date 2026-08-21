"use server";

import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { canManageOrganization } from "@/lib/permissions";
import { getBillingSnapshot } from "@/lib/billing";
import { premiumPriceId, seatPriceId, stripePost } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";

async function billingContext() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  const organization = workspace.organization;
  if (!organization) redirect("/setup");
  if (!canManageOrganization(workspace.role)) throw new Error("Only an owner or admin can manage billing.");
  const snapshot = await getBillingSnapshot(organization.id);
  return { workspace, organization, snapshot };
}

export async function createPremiumCheckoutAction(formData: FormData) {
  const { workspace, organization, snapshot } = await billingContext();
  if (snapshot.plan === "premium" && snapshot.billing_source === "stripe") return createBillingPortalAction();

  const interval = String(formData.get("interval")) === "year" ? "year" : "month";
  const price = premiumPriceId(interval);
  const params: Record<string, string | number | boolean | null | undefined> = {
    mode: "subscription",
    success_url: `${APP_URL}/app/settings/billing?checkout=success`,
    cancel_url: `${APP_URL}/app/settings/billing?checkout=cancelled`,
    "line_items[0][price]": price,
    "line_items[0][quantity]": 1,
    client_reference_id: organization.id,
    "metadata[organization_id]": organization.id,
    "metadata[kind]": "plan",
    "subscription_data[metadata][organization_id]": organization.id,
    "subscription_data[metadata][kind]": "plan",
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    "tax_id_collection[enabled]": true,
  };
  if (snapshot.stripe_customer_id) params.customer = snapshot.stripe_customer_id;
  else if (workspace.email) params.customer_email = workspace.email;

  const session = await stripePost("/checkout/sessions", params);
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(String(session.url));
}

export async function createSeatCheckoutAction() {
  const { workspace, organization, snapshot } = await billingContext();
  if (snapshot.stripe_seat_subscription_id) return createBillingPortalAction();
  const params: Record<string, string | number | boolean | null | undefined> = {
    mode: "subscription",
    success_url: `${APP_URL}/app/settings/billing?seat=success`,
    cancel_url: `${APP_URL}/app/settings/billing?seat=cancelled`,
    "line_items[0][price]": seatPriceId(),
    "line_items[0][quantity]": 1,
    client_reference_id: organization.id,
    "metadata[organization_id]": organization.id,
    "metadata[kind]": "seat",
    "subscription_data[metadata][organization_id]": organization.id,
    "subscription_data[metadata][kind]": "seat",
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    "tax_id_collection[enabled]": true,
  };
  if (snapshot.stripe_customer_id) params.customer = snapshot.stripe_customer_id;
  else if (workspace.email) params.customer_email = workspace.email;

  const session = await stripePost("/checkout/sessions", params);
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(String(session.url));
}

export async function createBillingPortalAction() {
  const { snapshot } = await billingContext();
  if (!snapshot.stripe_customer_id) throw new Error("No Stripe billing profile exists yet.");
  const session = await stripePost("/billing_portal/sessions", {
    customer: snapshot.stripe_customer_id,
    return_url: `${APP_URL}/app/settings/billing`,
  });
  if (!session.url) throw new Error("Stripe did not return a billing portal URL.");
  redirect(String(session.url));
}
