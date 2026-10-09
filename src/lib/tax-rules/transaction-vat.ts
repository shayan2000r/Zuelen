// VAT split for a transaction entered by hand (create and edit forms, and the server actions behind them).
// The database applies the same rules when it posts the transaction (classify_and_post_source_transaction);
// see docs/compliance/REGULATORY_REGISTER.md (A1, A9, A13).

import { isOtherEuCountry } from "./eu.ts";
import { isVatRateAllowed } from "./vat.ts";

export const VAT_TREATMENTS = [
  "domestic",
  "eu_b2b_reverse_charge",
  "eu_acquisition",
  "non_eu",
  "exempt_or_zero",
  "outside_scope",
  "unknown",
] as const;
export type VatTreatment = (typeof VAT_TREATMENTS)[number];

export type TransactionVatInput = {
  amount: number;
  rate: number;
  /** Whether `amount` includes VAT. Only used for Luxembourg VAT. */
  included: boolean;
  treatment: string;
  direction: "income" | "expense" | string;
  occurredOn: string;
  vatRegistered: boolean;
  /** Counterparty country (ISO code). Required for a business abroad; decides the VAT return boxes. Omit to skip the check. */
  country?: string | null;
};

export type TransactionVatErrorCode =
  | "amount"
  | "treatment"
  | "rate"
  | "reverse_charge_rate"
  | "income_vat_not_registered"
  | "country_abroad"
  | "country_eu";

export type TransactionVat =
  | {
      ok: true;
      /** Amount that moved through the bank. */
      gross: number;
      /** Amount excluding VAT. */
      net: number;
      /**
       * Net amount to store on the transaction. Null for a reverse-charge purchase: the self-assessed VAT is
       * not part of the amount paid, so net + VAT does not equal the gross amount.
       */
      storedNet: number | null;
      vat: number;
      rate: number;
      treatment: VatTreatment;
      selfAssessed: boolean;
    }
  | { ok: false; error: TransactionVatErrorCode };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeTransactionVat(input: TransactionVatInput): TransactionVat {
  const { amount, included, direction, occurredOn, vatRegistered } = input;
  const treatment = input.treatment as VatTreatment;
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "amount" };
  if (!VAT_TREATMENTS.includes(treatment)) return { ok: false, error: "treatment" };
  const entered = roundMoney(amount);
  const noVat = {
    ok: true,
    gross: entered,
    net: entered,
    storedNet: entered,
    vat: 0,
    rate: 0,
    treatment,
    selfAssessed: false,
  } as const;

  // No Luxembourg VAT: imports, exempt or zero-rated supplies, out-of-scope items, and "not sure"
  // (Zuelen never guesses VAT).
  if (
    treatment === "non_eu" ||
    treatment === "exempt_or_zero" ||
    treatment === "outside_scope" ||
    treatment === "unknown"
  )
    return noVat;
  // An intra-Community acquisition is a purchase of goods; a sale cannot have this treatment.
  if (treatment === "eu_acquisition" && direction === "income") return { ok: false, error: "treatment" };

  // Reverse charge applies to a business established abroad; an intra-Community acquisition comes from
  // another Member State. The country also decides the boxes of the VAT return. (Not checked when the
  // country is not given, for the live preview in the forms.)
  if (input.country !== undefined) {
    const country = input.country?.trim().toUpperCase() || null;
    if (treatment === "eu_b2b_reverse_charge" && (!country || country === "LU"))
      return { ok: false, error: "country_abroad" };
    if (treatment === "eu_acquisition" && !isOtherEuCountry(country)) return { ok: false, error: "country_eu" };
  }

  const rate = Number(input.rate);
  if (!Number.isFinite(rate) || !isVatRateAllowed(rate, occurredOn)) return { ok: false, error: "rate" };

  if (treatment === "eu_b2b_reverse_charge" || treatment === "eu_acquisition") {
    // A service to a business customer abroad carries no Luxembourg VAT (place of supply: the customer's country).
    if (direction === "income") return noVat;
    // A service from a business abroad, or goods from another Member State: the Luxembourg buyer
    // self-assesses VAT at the Luxembourg rate.
    if (rate <= 0) return { ok: false, error: "reverse_charge_rate" };
    const vat = roundMoney((entered * rate) / 100);
    return { ok: true, gross: entered, net: entered, storedNet: null, vat, rate, treatment, selfAssessed: true };
  }

  if (rate === 0) return noVat;
  // A business that is not VAT registered cannot charge VAT. It can still pay VAT on purchases (as a cost).
  if (direction === "income" && !vatRegistered) return { ok: false, error: "income_vat_not_registered" };
  if (included) {
    const net = roundMoney(entered / (1 + rate / 100));
    return {
      ok: true,
      gross: entered,
      net,
      storedNet: net,
      vat: roundMoney(entered - net),
      rate,
      treatment,
      selfAssessed: false,
    };
  }
  const vat = roundMoney((entered * rate) / 100);
  return {
    ok: true,
    gross: roundMoney(entered + vat),
    net: entered,
    storedNet: entered,
    vat,
    rate,
    treatment,
    selfAssessed: false,
  };
}

const MESSAGES: Record<TransactionVatErrorCode, { en: string; fr: string }> = {
  amount: { en: "Amount must be greater than zero.", fr: "Le montant doit être supérieur à zéro." },
  treatment: { en: "Choose a valid VAT situation.", fr: "Choisissez une situation TVA valide." },
  rate: {
    en: "Choose a Luxembourg VAT rate that was in force on the transaction date.",
    fr: "Choisissez un taux de TVA luxembourgeois en vigueur à la date de l’opération.",
  },
  reverse_charge_rate: {
    en: "Choose the Luxembourg VAT rate you self-assess on this EU purchase (usually the standard rate).",
    fr: "Choisissez le taux de TVA luxembourgeois à autoliquider sur cet achat UE (en général le taux normal).",
  },
  country_abroad: {
    en: "Enter the country of the business abroad (2 letters, for example DE or US).",
    fr: "Indiquez le pays de l’entreprise étrangère (2 lettres, par exemple DE ou US).",
  },
  country_eu: {
    en: "An intra-Community acquisition comes from another EU country: enter the supplier’s country.",
    fr: "Une acquisition intracommunautaire provient d’un autre pays de l’UE : indiquez le pays du fournisseur.",
  },
  income_vat_not_registered: {
    en: "This business is not marked as VAT registered, so it cannot charge VAT. Choose “No VAT / exempt” or update the VAT profile in Settings.",
    fr: "Cette entreprise n’est pas configurée comme assujettie à la TVA et ne peut donc pas facturer de TVA. Choisissez « Pas de TVA / exonéré » ou mettez à jour le profil TVA dans les Paramètres.",
  },
};

export function transactionVatErrorMessage(code: TransactionVatErrorCode, locale: "en" | "fr") {
  return MESSAGES[code][locale];
}
