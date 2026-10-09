// VAT split for a transaction entered by hand (create and edit forms, and the server actions behind them).
// The database applies the same rules when it posts the transaction (classify_and_post_source_transaction);
// see docs/compliance/REGULATORY_REGISTER.md (A1, A9, A13).

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
};

export type TransactionVatErrorCode =
  | "amount"
  | "treatment"
  | "rate"
  | "reverse_charge_rate"
  | "income_vat_not_registered";

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

  const rate = Number(input.rate);
  if (!Number.isFinite(rate) || !isVatRateAllowed(rate, occurredOn)) return { ok: false, error: "rate" };

  if (treatment === "eu_b2b_reverse_charge" || treatment === "eu_acquisition") {
    // A sale to an EU business customer carries no Luxembourg VAT: the customer accounts for it.
    if (direction === "income") return noVat;
    // A service or goods bought from an EU business: the Luxembourg buyer self-assesses VAT at the
    // Luxembourg rate.
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
  income_vat_not_registered: {
    en: "This business is not marked as VAT registered, so it cannot charge VAT. Choose “No VAT / exempt” or update the VAT profile in Settings.",
    fr: "Cette entreprise n’est pas configurée comme assujettie à la TVA et ne peut donc pas facturer de TVA. Choisissez « Pas de TVA / exonéré » ou mettez à jour le profil TVA dans les Paramètres.",
  },
};

export function transactionVatErrorMessage(code: TransactionVatErrorCode, locale: "en" | "fr") {
  return MESSAGES[code][locale];
}
