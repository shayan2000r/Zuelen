// EU Member States, as VAT country codes (Greece is EL in VAT numbers, GR in ISO 3166).
export const EU_VAT_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "GR",
  "ES",
  "FI",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

/** Another EU Member State than Luxembourg. */
export function isOtherEuCountry(country: string | null | undefined) {
  const code = country?.trim().toUpperCase();
  return Boolean(code && code !== "LU" && EU_VAT_COUNTRIES.has(code));
}
