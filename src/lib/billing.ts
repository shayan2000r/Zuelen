import { createClient } from "@/lib/supabase/server";

export type PlanName = "basic" | "premium";
export type BillingInterval = "month" | "year" | null;
export type UsageMetric = "transactions" | "documents" | "invoices" | "bank_imports";

export type UsageLine = { used: number; limit: number | null };
export type BillingSnapshot = {
  plan: PlanName;
  status: string;
  billing_source: "stripe" | "internal";
  billing_interval: BillingInterval;
  period_start: string;
  period_end: string;
  cancel_at_period_end: boolean;
  additional_seats: number;
  billable_seats: number;
  stripe_customer_id: string | null;
  stripe_plan_subscription_id: string | null;
  stripe_seat_subscription_id: string | null;
  usage: Record<UsageMetric, UsageLine>;
};

const EMPTY_USAGE: Record<UsageMetric, UsageLine> = {
  transactions: { used: 0, limit: 15 },
  documents: { used: 0, limit: 3 },
  invoices: { used: 0, limit: 3 },
  bank_imports: { used: 0, limit: 1 },
};

function normalizeSnapshot(value: unknown): BillingSnapshot {
  const raw = (value ?? {}) as Partial<BillingSnapshot> & { usage?: Partial<Record<UsageMetric, UsageLine>> };
  const plan: PlanName = raw.plan === "premium" ? "premium" : "basic";
  const fallbackPeriodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
  return {
    plan,
    status: typeof raw.status === "string" ? raw.status : "active",
    billing_source: raw.billing_source === "internal" ? "internal" : "stripe",
    billing_interval: raw.billing_interval === "month" || raw.billing_interval === "year" ? raw.billing_interval : null,
    period_start: typeof raw.period_start === "string" ? raw.period_start : new Date().toISOString(),
    period_end: typeof raw.period_end === "string" ? raw.period_end : fallbackPeriodEnd,
    cancel_at_period_end: Boolean(raw.cancel_at_period_end),
    additional_seats: Number.isFinite(raw.additional_seats) ? Number(raw.additional_seats) : 0,
    billable_seats: Number.isFinite(raw.billable_seats) ? Number(raw.billable_seats) : 0,
    stripe_customer_id: typeof raw.stripe_customer_id === "string" ? raw.stripe_customer_id : null,
    stripe_plan_subscription_id: typeof raw.stripe_plan_subscription_id === "string" ? raw.stripe_plan_subscription_id : null,
    stripe_seat_subscription_id: typeof raw.stripe_seat_subscription_id === "string" ? raw.stripe_seat_subscription_id : null,
    usage: {
      transactions: raw.usage?.transactions ?? { ...EMPTY_USAGE.transactions, limit: plan === "premium" ? null : 15 },
      documents: raw.usage?.documents ?? { ...EMPTY_USAGE.documents, limit: plan === "premium" ? null : 3 },
      invoices: raw.usage?.invoices ?? { ...EMPTY_USAGE.invoices, limit: plan === "premium" ? null : 3 },
      bank_imports: raw.usage?.bank_imports ?? { ...EMPTY_USAGE.bank_imports, limit: plan === "premium" ? null : 1 },
    },
  };
}

export async function getBillingSnapshot(organizationId: string): Promise<BillingSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_billing_snapshot", { p_organization_id: organizationId });
  if (error) throw new Error(error.message);
  return normalizeSnapshot(data);
}

export async function hasPremiumAccess(organizationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_premium_access", { p_organization_id: organizationId });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function assertUsageAvailable(organizationId: string, metric: UsageMetric, quantity = 1) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assert_usage_available", {
    p_organization_id: organizationId,
    p_metric: metric,
    p_quantity: quantity,
  });
  if (error) throw new Error(error.message);
}

export function billingLimitMessage(error: unknown, locale: "en" | "fr" = "en") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/ZU_BILLING_LIMIT:([^:]+):(\d+):(\d+)/);
  if (!match) return null;
  const metric = match[1] as UsageMetric;
  const used = Number(match[2]);
  const limit = Number(match[3]);
  const labels = locale === "fr"
    ? { transactions: "transactions", documents: "documents", invoices: "factures", bank_imports: "imports bancaires" }
    : { transactions: "transactions", documents: "documents", invoices: "invoices", bank_imports: "bank imports" };
  return locale === "fr"
    ? `Vous avez utilisé ${used} sur ${limit} ${labels[metric]} inclus dans Basic. Passez à Premium pour continuer sans limite.`
    : `You've used ${used} of ${limit} ${labels[metric]} included in Basic. Upgrade to Premium to continue without limits.`;
}

export function seatLimitMessage(error: unknown, locale: "en" | "fr" = "en") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message.includes("ZU_SEAT_LIMIT")) return null;
  return locale === "fr"
    ? "Votre siège professionnel inclus est déjà utilisé. Ajoutez un siège supplémentaire à 9,99 € / mois dans Facturation avant d’inviter cette personne."
    : "Your included professional seat is already in use. Add an additional €9.99/month seat in Billing before inviting this person.";
}
