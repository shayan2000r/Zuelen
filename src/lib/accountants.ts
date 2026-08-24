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
  portfolio_url: string | null;
  qualifications: string | null;
  client_references: string | null;
  years_experience: number | null;
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

// Stripe Price IDs are public catalog identifiers, not secrets. Keep production
// fallbacks here so the live accountant plans remain deployable even when an
// environment-variable writer is unavailable. Environment variables still
// override these values for staging or future catalog migrations.
const LIVE_ACCOUNTANT_BASIC_MONTHLY_PRICE_ID = "price_1U7tTjAUTtqJnPRbkC4yLryy";
const LIVE_ACCOUNTANT_PREMIUM_MONTHLY_PRICE_ID = "price_1U7tTqAUTtqJnPRbcr9iUMTN";

const LANGUAGE_META: Record<string, { flag: string; en: string; fr: string }> = {
  Luxembourgish: { flag: "🇱🇺", en: "Luxembourgish", fr: "Luxembourgeois" },
  French: { flag: "🇫🇷", en: "French", fr: "Français" },
  English: { flag: "🇬🇧", en: "English", fr: "Anglais" },
  German: { flag: "🇩🇪", en: "German", fr: "Allemand" },
  Portuguese: { flag: "🇵🇹", en: "Portuguese", fr: "Portugais" },
  Italian: { flag: "🇮🇹", en: "Italian", fr: "Italien" },
  Spanish: { flag: "🇪🇸", en: "Spanish", fr: "Espagnol" },
};

const SPECIALTY_FR: Record<string, string> = {
  Bookkeeping: "Tenue comptable",
  VAT: "TVA",
  "Annual accounts": "Comptes annuels",
  "Corporate tax": "Fiscalité des sociétés",
  Payroll: "Paie",
  "Company formation": "Création d’entreprise",
  "eCDF & RCS filings": "Dépôts eCDF & RCS",
  "Management reporting": "Reporting de gestion",
};

const BUSINESS_TYPE_FR: Record<string, string> = {
  Freelancers: "Freelances",
  "Sole traders": "Indépendants",
  "SARL-S": "SARL-S",
  SARL: "SARL",
  SA: "SA",
  Startups: "Startups",
  Retail: "Commerce de détail",
  "Professional services": "Services professionnels",
  "E-commerce": "E-commerce",
};

export function accountantLanguageLabel(value: string, locale: "en" | "fr" = "en", withFlag = false) {
  const meta = LANGUAGE_META[value];
  const label = meta ? meta[locale] : value;
  return withFlag && meta ? `${meta.flag} ${label}` : label;
}

export function accountantSpecialtyLabel(value: string, locale: "en" | "fr" = "en") {
  return locale === "fr" ? SPECIALTY_FR[value] ?? value : value;
}

export function accountantBusinessTypeLabel(value: string, locale: "en" | "fr" = "en") {
  return locale === "fr" ? BUSINESS_TYPE_FR[value] ?? value : value;
}

export function accountantStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && accountantPriceId("basic") && accountantPriceId("premium"));
}

export function accountantPriceId(tier: AccountantTier) {
  return tier === "premium"
    ? process.env.STRIPE_ACCOUNTANT_PREMIUM_MONTHLY_PRICE_ID || LIVE_ACCOUNTANT_PREMIUM_MONTHLY_PRICE_ID
    : process.env.STRIPE_ACCOUNTANT_BASIC_MONTHLY_PRICE_ID || LIVE_ACCOUNTANT_BASIC_MONTHLY_PRICE_ID;
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
