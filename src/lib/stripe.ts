import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export type StripeObject = Record<string, any>;

export function stripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID &&
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID &&
    process.env.STRIPE_SEAT_MONTHLY_PRICE_ID
  );
}

export function stripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe billing is not configured yet.");
  return key;
}

export async function stripePost(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    body.set(key, String(value));
  }
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const json = (await response.json()) as StripeObject;
  if (!response.ok) throw new Error(json?.error?.message || "Stripe request failed.");
  return json;
}

export async function stripeGet(path: string) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });
  const json = (await response.json()) as StripeObject;
  if (!response.ok) throw new Error(json?.error?.message || "Stripe request failed.");
  return json;
}

export function premiumPriceId(interval: "month" | "year") {
  const id = interval === "year"
    ? process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID
    : process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
  if (!id) throw new Error("The selected Premium Stripe price is not configured.");
  return id;
}

export function seatPriceId() {
  const id = process.env.STRIPE_SEAT_MONTHLY_PRICE_ID;
  if (!id) throw new Error("The additional-seat Stripe price is not configured.");
  return id;
}

export function verifyStripeSignature(payload: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const parts = signatureHeader.split(",").map(part => part.trim());
  const timestamp = parts.find(part => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter(part => part.startsWith("v1=")).map(part => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some(signature => {
    try {
      const actualBuffer = Buffer.from(signature, "hex");
      return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}
