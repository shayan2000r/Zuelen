import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeGet, verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, any>;

function idOf(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

function unixDate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function subscriptionItems(subscription: JsonObject) {
  const data = subscription?.items?.data;
  return Array.isArray(data) ? data : [];
}

function normalizedSubscriptionStatus(value: unknown) {
  const status = typeof value === "string" ? value : "incomplete";
  return ["active", "trialing", "past_due", "unpaid", "incomplete", "canceled"].includes(status) ? status : "incomplete";
}

async function syncAccountantSubscription(subscription: JsonObject, metadata: Record<string, string>) {
  const profileId = metadata.accountant_profile_id;
  if (!profileId) return;
  const admin = createAdminClient();
  const items = subscriptionItems(subscription);
  const firstItem = items[0] ?? {};
  const priceId = idOf(firstItem?.price);
  const configuredBasic = process.env.STRIPE_ACCOUNTANT_BASIC_MONTHLY_PRICE_ID;
  const configuredPremium = process.env.STRIPE_ACCOUNTANT_PREMIUM_MONTHLY_PRICE_ID;
  // Price is the source of truth after a Customer Portal plan change. Metadata is
  // retained as a fallback for the original Checkout-created subscription.
  const tier = priceId === configuredPremium
    ? "premium"
    : priceId === configuredBasic
      ? "basic"
      : metadata.tier === "premium"
        ? "premium"
        : metadata.tier === "basic"
          ? "basic"
          : null;
  if (!tier) return;
  const status = normalizedSubscriptionStatus(subscription.status);
  const periodStart = unixDate(subscription.current_period_start ?? firstItem.current_period_start);
  const periodEnd = unixDate(subscription.current_period_end ?? firstItem.current_period_end);
  const trialEnd = unixDate(subscription.trial_end);
  const customerId = idOf(subscription.customer);
  const { error } = await admin.from("accountant_listing_subscriptions").upsert({
    profile_id: profileId,
    tier,
    status,
    trial_end: trialEnd,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    stripe_customer_id: customerId,
    stripe_subscription_id: status === "canceled" ? null : String(subscription.id),
    stripe_price_id: priceId,
  }, { onConflict: "profile_id" });
  if (error) throw new Error(error.message);
}

async function syncSubscription(subscription: JsonObject) {
  const metadata = (subscription.metadata ?? {}) as Record<string, string>;
  const kind = metadata.kind;
  if (kind === "accountant_listing") {
    await syncAccountantSubscription(subscription, metadata);
    return;
  }

  const organizationId = metadata.organization_id;
  if (!organizationId || (kind !== "plan" && kind !== "seat")) return;
  const admin = createAdminClient();
  const items = subscriptionItems(subscription);
  const firstItem = items[0] ?? {};
  const normalizedStatus = normalizedSubscriptionStatus(subscription.status);
  const active = ["active", "trialing", "past_due"].includes(normalizedStatus);
  const customerId = idOf(subscription.customer);

  if (kind === "plan") {
    const interval = firstItem?.price?.recurring?.interval;
    const priceId = idOf(firstItem?.price);
    const periodStart = unixDate(subscription.current_period_start ?? firstItem.current_period_start);
    const periodEnd = unixDate(subscription.current_period_end ?? firstItem.current_period_end);
    const update: Record<string, unknown> = {
      plan: active ? "premium" : "basic",
      status: normalizedStatus,
      billing_source: "stripe",
      billing_interval: interval === "year" ? "year" : interval === "month" ? "month" : null,
      stripe_plan_subscription_id: active || normalizedStatus !== "canceled" ? String(subscription.id) : null,
      stripe_plan_price_id: priceId,
      stripe_customer_id: customerId,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    };
    if (periodStart) update.billing_anchor = periodStart;
    const { error } = await admin.from("organization_subscriptions").update(update).eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    return;
  }

  const quantity = active
    ? items.reduce((sum: number, item: JsonObject) => sum + Math.max(0, Number(item.quantity ?? 0)), 0)
    : 0;
  const priceId = idOf(firstItem?.price);
  const { error } = await admin.from("organization_subscriptions").update({
    stripe_customer_id: customerId,
    stripe_seat_subscription_id: active || normalizedStatus !== "canceled" ? String(subscription.id) : null,
    stripe_seat_price_id: priceId,
    additional_seats: quantity,
  }).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  let event: JsonObject;
  try {
    event = JSON.parse(payload) as JsonObject;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = typeof event.id === "string" ? event.id : null;
  const eventType = typeof event.type === "string" ? event.type : "unknown";
  if (!eventId) return NextResponse.json({ error: "Missing event id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("stripe_webhook_events").select("event_id").eq("event_id", eventId).maybeSingle();
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  const object = event?.data?.object as JsonObject | undefined;
  try {
    if (eventType === "checkout.session.completed" && object) {
      const subscriptionId = idOf(object.subscription);
      if (subscriptionId) await syncSubscription(await stripeGet(`/subscriptions/${encodeURIComponent(subscriptionId)}`));
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(eventType) && object) {
      await syncSubscription(object);
    }

    const { error } = await admin.from("stripe_webhook_events").insert({ event_id: eventId, event_type: eventType });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", eventId, eventType, error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}