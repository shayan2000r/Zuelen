export type AccountantTier = "basic" | "premium";
export type AccountantApprovalStatus = "pending" | "approved" | "rejected";
export type AccountantSubscriptionStatus = "active" | "trialing" | "past_due" | "unpaid" | "incomplete" | "canceled";

export type AccountantListingSubscription = {
  profile_id: string;
  tier: AccountantTier;
  status: AccountantSubscriptionStatus;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
};

export type AccountantProfile = {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  firm_name: string | null;
  professional_title: string;
  bio: string | null;
  location: string | null;
  languages: string[];
  specialties: string[];
  business_types: string[];
  email: string | null;
  phone: string | null;
  website: string | null;
  photo_url: string | null;
  accepting_new_clients: boolean;
  works_remotely: boolean;
  works_in_person: boolean;
  approval_status: AccountantApprovalStatus;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const ACCOUNTANT_LANGUAGES = ["Luxembourgish", "French", "English", "German", "Portuguese", "Italian", "Spanish"] as const;
export const ACCOUNTANT_SPECIALTIES = ["Bookkeeping", "VAT", "Annual accounts", "Corporate tax", "Payroll", "Company formation", "eCDF & RCS filings", "Management reporting"] as const;
export const ACCOUNTANT_BUSINESS_TYPES = ["Freelancers", "Sole traders", "SARL-S", "SARL", "SA", "Startups", "Retail", "Professional services", "E-commerce"] as const;

export function accountantStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_ACCOUNTANT_BASIC_MONTHLY_PRICE_ID &&
    process.env.STRIPE_ACCOUNTANT_PREMIUM_MONTHLY_PRICE_ID
  );
}

export function accountantPriceId(tier: AccountantTier) {
  const id = tier === "premium"
    ? process.env.STRIPE_ACCOUNTANT_PREMIUM_MONTHLY_PRICE_ID
    : process.env.STRIPE_ACCOUNTANT_BASIC_MONTHLY_PRICE_ID;
  if (!id) throw new Error(`The Accountant ${tier === "premium" ? "Premium" : "Basic"} Stripe price is not configured.`);
  return id;
}

export function normalizeAccountantTier(value: unknown): AccountantTier {
  return value === "premium" ? "premium" : "basic";
}

export function normalizeWebsite(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function accountantInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "A";
}