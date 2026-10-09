// Luxembourg VAT return boxes computed from issued invoices and posted transactions.
// Every amount is traceable to a source item; anything the books cannot place in a box with certainty is
// returned as an issue instead of being guessed. See docs/compliance/REGULATORY_REGISTER.md (A11).

import { isOtherEuCountry } from "../tax-rules/eu.ts";
import { RATE_BOXES, type VatReturnForm } from "./forms.ts";

export type VatTreatment =
  | "domestic"
  | "eu_b2b_reverse_charge"
  | "eu_acquisition"
  | "non_eu"
  | "exempt_or_zero"
  | "outside_scope"
  | "unknown";

/** A sale: an issued invoice line, or a posted income transaction. Amounts in the base currency. */
export type VatSale = {
  id: string;
  source: "invoice" | "transaction";
  label: string;
  date: string;
  treatment: VatTreatment | string;
  country: string | null;
  rate: number | null;
  base: number;
  vat: number;
  /** Ledger account the revenue is posted to (for example 7033). */
  accountCode: string | null;
};

/** A purchase: a posted expense transaction, or a supplier refund (negative amounts). Amounts in the base currency. */
export type VatPurchase = {
  id: string;
  label: string;
  date: string;
  treatment: VatTreatment | string;
  country: string | null;
  rate: number | null;
  base: number;
  vat: number;
  accountCode: string | null;
};

export type VatCompanyProfile = {
  vatRegistered: boolean;
  exemptionBasis: "franchise" | "exempt_activity" | null;
  deductionMode: "full" | "partial" | "none";
  deductionRatio: number | null;
};

export type VatIssueCode =
  | "zero_rate_sale"
  | "sale_abroad_unclear"
  | "country_missing"
  | "rate_not_on_form"
  | "unknown_treatment"
  | "revenue_branch_unclear";

export type VatIssue = { code: VatIssueCode; itemId: string; label: string; amount: number };

export type VatReturnResult = {
  form: VatReturnForm;
  boxes: Record<string, number>;
  issues: VatIssue[];
};

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Share of input VAT the business may deduct (LTVA art. 44, 50; none when not VAT registered). */
export function deductionShare(company: VatCompanyProfile) {
  if (!company.vatRegistered || company.deductionMode === "none") return 0;
  if (company.deductionMode === "partial") return Math.min(Math.max(company.deductionRatio ?? 0, 0), 100) / 100;
  return 1;
}

/** Annual return turnover branch from the revenue account (PCN 2020: 702 products, 706 goods, 703/705 services). */
function revenueBranch(code: string | null): "001" | "002" | "004" | "007" | null {
  if (!code) return null;
  if (code.startsWith("702")) return "001";
  if (code.startsWith("706") || code.startsWith("704")) return "002";
  if (code.startsWith("703") || code.startsWith("705")) return "004";
  if (code.startsWith("708")) return "007";
  return null;
}

/** Annual return input-VAT group from the expense account: 60 purchases (stock entries), class 2 (capital), other. */
function expenseGroup(code: string | null): "stock" | "capital" | "operational" {
  if (code?.startsWith("60")) return "stock";
  if (code?.startsWith("2")) return "capital";
  return "operational";
}

const ANNUAL_INPUT_BOXES = {
  stock: { invoiced: "077", acquisition: "078", reverse: "404" },
  capital: { invoiced: "081", acquisition: "082", reverse: "405" },
  operational: { invoiced: "085", acquisition: "086", reverse: "406" },
} as const;

/** Goods sold (as opposed to services), from the revenue account. Invoices in Zuelen are service invoices. */
function isGoodsSale(sale: VatSale) {
  const branch = revenueBranch(sale.accountCode);
  return branch === "001" || branch === "002";
}

export function computeVatReturn(input: {
  form: VatReturnForm;
  company: VatCompanyProfile;
  sales: VatSale[];
  purchases: VatPurchase[];
}): VatReturnResult {
  const { form, company } = input;
  const boxes: Record<string, number> = {};
  const issues: VatIssue[] = [];
  const add = (box: string, amount: number) => {
    boxes[box] = cents((boxes[box] ?? 0) + amount);
  };
  const issue = (code: VatIssueCode, item: { id: string; label: string }, amount: number) =>
    issues.push({ code, itemId: item.id, label: item.label, amount: cents(amount) });

  // ---- Sales (sections I and II.A) ----
  for (const sale of input.sales) {
    let exemptionBox: string | null = null;
    if (sale.treatment === "outside_scope") continue; // not turnover (for example a grant or an insurance indemnity)
    if (sale.treatment === "unknown") {
      issue("unknown_treatment", sale, sale.base);
      continue;
    }
    if (sale.treatment === "domestic" && sale.vat > 0) {
      const boxPair = sale.rate === null ? undefined : RATE_BOXES.sales[sale.rate as keyof typeof RATE_BOXES.sales];
      if (!boxPair) {
        issue("rate_not_on_form", sale, sale.base);
        continue;
      }
      add(boxPair[0], sale.base);
      add(boxPair[1], sale.vat);
    } else if (sale.treatment === "domestic" || sale.treatment === "exempt_or_zero") {
      // No VAT charged on a Luxembourg supply: franchise (art. 57bis) or exempt activity (art. 44).
      if (!company.vatRegistered || company.exemptionBasis === "franchise") exemptionBox = "481";
      else if (company.exemptionBasis === "exempt_activity") exemptionBox = "016";
      else {
        issue("zero_rate_sale", sale, sale.base);
        continue;
      }
    } else if (sale.treatment === "eu_b2b_reverse_charge" || sale.treatment === "non_eu") {
      // Supply to a customer abroad: the customer's country and goods / services decide the box.
      const country = sale.country?.toUpperCase() ?? null;
      if (!country || country === "LU") {
        issue("country_missing", sale, sale.base);
        continue;
      }
      const goods = isGoodsSale(sale);
      if (isOtherEuCountry(country)) {
        // Business customer in another Member State (reverse charge): goods 457 / 013, services 423.
        if (sale.treatment !== "eu_b2b_reverse_charge") {
          issue("sale_abroad_unclear", sale, sale.base);
          continue;
        }
        exemptionBox = goods ? (form === "DECA" ? "013" : "457") : "423";
      } else if (goods) {
        exemptionBox = "014"; // export of goods outside the EU
      } else if (sale.treatment === "eu_b2b_reverse_charge") {
        exemptionBox = "019"; // service to a business established outside the EU: supplied abroad (art. 17/1/b)
      } else {
        // A service to a customer outside the EU may still be taxable in Luxembourg (private customer).
        issue("sale_abroad_unclear", sale, sale.base);
        continue;
      }
    } else {
      issue("unknown_treatment", sale, sale.base);
      continue;
    }

    if (form === "DECA") {
      const branch = sale.source === "invoice" ? "004" : revenueBranch(sale.accountCode);
      if (!branch) {
        issue("revenue_branch_unclear", sale, sale.base);
        add("004", sale.base);
      } else add(branch, sale.base);
    } else add("472", sale.base);
    if (exemptionBox) add(exemptionBox, sale.base);
  }

  // ---- Purchases (sections II.B, II.E and III) ----
  const share = deductionShare(company);
  const nonDeductibleBox = company.deductionMode === "partial" && company.vatRegistered ? "095" : "094";
  for (const purchase of input.purchases) {
    if (purchase.vat === 0) continue;
    const group = expenseGroup(purchase.accountCode);
    let inputBox: string;
    if (purchase.treatment === "domestic") {
      inputBox = form === "DECA" ? ANNUAL_INPUT_BOXES[group].invoiced : "458";
    } else if (purchase.treatment === "eu_b2b_reverse_charge" || purchase.treatment === "eu_acquisition") {
      const goods = purchase.treatment === "eu_acquisition";
      if (!goods && !purchase.country) {
        issue("country_missing", purchase, purchase.vat);
        continue;
      }
      const fromEu = goods || isOtherEuCountry(purchase.country);
      const table = goods
        ? RATE_BOXES.intraCommunityAcquisitions
        : fromEu
          ? RATE_BOXES.servicesFromEu
          : RATE_BOXES.servicesFromOutsideEu;
      const boxPair = purchase.rate === null ? undefined : table[purchase.rate as keyof typeof table];
      if (!boxPair) {
        issue("rate_not_on_form", purchase, purchase.vat);
        continue;
      }
      add(boxPair[0], purchase.base);
      add(boxPair[1], purchase.vat);
      if (goods) {
        add("051", purchase.base);
        add("056", purchase.vat);
        inputBox = form === "DECA" ? ANNUAL_INPUT_BOXES[group].acquisition : "459";
      } else {
        add(fromEu ? "436" : "463", purchase.base);
        add(fromEu ? "462" : "464", purchase.vat);
        add("409", purchase.base);
        add("410", purchase.vat);
        inputBox = form === "DECA" ? ANNUAL_INPUT_BOXES[group].reverse : "461";
      }
    } else {
      // VAT recorded under another treatment (for example foreign VAT) is a cost, not Luxembourg input VAT.
      continue;
    }
    add(inputBox, purchase.vat);
    const nonDeductible = cents(purchase.vat - cents(purchase.vat * share));
    if (nonDeductible !== 0) add(nonDeductibleBox, nonDeductible);
  }

  // ---- Totals, as defined on the form ----
  const sum = (...codes: string[]) => cents(codes.reduce((total, code) => total + (boxes[code] ?? 0), 0));
  if (form === "DECA") boxes["012"] = sum("001", "002", "004", "007");
  else {
    boxes["454"] = sum("472");
    boxes["012"] = sum("454");
  }
  boxes["021"] = sum(form === "DECA" ? "013" : "457", "014", "015", "016", "481", "423", "019");
  boxes["022"] = cents(boxes["012"] - boxes["021"]);
  const salesPairs = Object.values(RATE_BOXES.sales);
  boxes["037"] = sum(...salesPairs.map(([base]) => base));
  boxes["046"] = sum(...salesPairs.map(([, tax]) => tax));
  boxes["076"] = sum("046", "056", "410");
  if (form === "DECA") {
    boxes["080"] = sum("077", "078", "404");
    boxes["084"] = sum("081", "082", "405");
    boxes["088"] = sum("085", "086", "406");
    boxes["093"] = sum("080", "084", "088");
    boxes["101"] = 0;
  } else boxes["093"] = sum("458", "459", "461");
  boxes["097"] = sum("094", "095");
  boxes["102"] = cents(boxes["093"] - boxes["097"] + (boxes["101"] ?? 0));
  boxes["103"] = boxes["076"];
  boxes["104"] = boxes["102"];
  boxes["105"] = cents(boxes["103"] - boxes["104"]);
  return { form, boxes, issues };
}
