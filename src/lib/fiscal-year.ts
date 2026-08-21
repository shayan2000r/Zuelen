import { cookies } from "next/headers";

export const FISCAL_YEAR_COOKIE = "zuelen-fiscal-year";

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function currentFiscalYear(startMonth = 1, now = new Date()) {
  const month = now.getUTCMonth() + 1;
  return month >= startMonth ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export function fiscalYearBounds(year: number, startMonth = 1) {
  const safeMonth = Number.isInteger(startMonth) && startMonth >= 1 && startMonth <= 12 ? startMonth : 1;
  const start = new Date(Date.UTC(year, safeMonth - 1, 1));
  const next = new Date(Date.UTC(year + 1, safeMonth - 1, 1));
  const end = new Date(next.getTime() - 86400000);
  return { year, start: iso(start), end: iso(end) };
}

export async function getActiveFiscalYear(startMonth = 1) {
  const fallback = currentFiscalYear(startMonth);
  const store = await cookies();
  const raw = Number(store.get(FISCAL_YEAR_COOKIE)?.value);
  if (!Number.isInteger(raw) || raw < 2000 || raw > fallback + 1) return fallback;
  return raw;
}

export function availableFiscalYears(activeYear: number, startMonth = 1) {
  const current = currentFiscalYear(startMonth);
  const first = Math.min(activeYear, current - 6);
  const last = Math.max(activeYear, current);
  return Array.from({ length: last - first + 1 }, (_, index) => last - index);
}

export function defaultDateForFiscalYear(year: number, startMonth = 1, now = new Date()) {
  const bounds = fiscalYearBounds(year, startMonth);
  const current = iso(now);
  if (current >= bounds.start && current <= bounds.end) return current;

  const monthDay = `${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const candidateYear = startMonth === 1 || now.getUTCMonth() + 1 >= startMonth ? year : year + 1;
  const candidate = `${candidateYear}-${monthDay}`;
  if (candidate >= bounds.start && candidate <= bounds.end) return candidate;
  return bounds.start;
}
