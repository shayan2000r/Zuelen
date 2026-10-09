// VAT return periods: calendar months (monthly filers), quarters (quarterly filers) and years (annual return).
// Every filer also files an annual return (guichet.lu, register A2–A4).

import type { VatReturnForm } from "./forms.ts";

export type VatFrequency = "monthly" | "quarterly" | "annual";
export type VatPeriod = { key: string; start: string; end: string; form: VatReturnForm };

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Parses "2026-03" (month), "2026-Q1" (quarter) or "2026" (year). */
export function parseVatPeriod(key: string): VatPeriod | null {
  let m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) {
    const year = Number(m[1]),
      month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return {
      key,
      start: `${year}-${pad(month)}-01`,
      end: `${year}-${pad(month)}-${lastDay(year, month)}`,
      form: "DECM",
    };
  }
  m = /^(\d{4})-Q([1-4])$/.exec(key);
  if (m) {
    const year = Number(m[1]),
      first = (Number(m[2]) - 1) * 3 + 1;
    return {
      key,
      start: `${year}-${pad(first)}-01`,
      end: `${year}-${pad(first + 2)}-${lastDay(year, first + 2)}`,
      form: "DECT",
    };
  }
  m = /^(\d{4})$/.exec(key);
  if (m) return { key, start: `${m[1]}-01-01`, end: `${m[1]}-12-31`, form: "DECA" };
  return null;
}

/** The periods of a calendar year for a filing frequency, followed by the annual return. */
export function vatPeriodsOfYear(year: number, frequency: VatFrequency): VatPeriod[] {
  const keys =
    frequency === "monthly"
      ? Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`)
      : frequency === "quarterly"
        ? [1, 2, 3, 4].map(q => `${year}-Q${q}`)
        : [];
  return [...keys, String(year)].map(key => parseVatPeriod(key)!);
}

/** The period that contains a date (the year for annual filers). */
export function currentVatPeriod(date: string, frequency: VatFrequency): VatPeriod {
  const year = Number(date.slice(0, 4)),
    month = Number(date.slice(5, 7));
  if (frequency === "monthly") return parseVatPeriod(`${year}-${pad(month)}`)!;
  if (frequency === "quarterly") return parseVatPeriod(`${year}-Q${Math.ceil(month / 3)}`)!;
  return parseVatPeriod(String(year))!;
}
