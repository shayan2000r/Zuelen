import "server-only";

type Locale = "en" | "fr";

function extractMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    return typeof value === "string" ? value : "";
  }
  return typeof error === "string" ? error : "";
}

const technicalPatterns = [
  /new row for relation/i,
  /violates .*constraint/i,
  /duplicate key value/i,
  /foreign key constraint/i,
  /null value in column/i,
  /invalid input syntax for type/i,
  /relation ".+" does not exist/i,
  /column ".+" does not exist/i,
  /function .+ does not exist/i,
  /operator does not exist/i,
  /schema cache/i,
  /postgrest/i,
  /\bPGRST\d+\b/i,
  /\bSQLSTATE\b/i,
  /permission denied for (table|schema|relation|sequence|function)/i,
  /current transaction is aborted/i,
  /deadlock detected/i,
  /could not serialize access/i,
  /DETAIL:/i,
  /Key \(.+\)=\(.+\)/i,
];

export function userFacingDataError(
  error: unknown,
  fallback?: string,
  locale: Locale = "en",
) {
  const message = extractMessage(error).trim();
  const safeFallback =
    fallback ??
    (locale === "fr"
      ? "Zuelen n’a pas pu terminer cette action. Réessayez dans un instant."
      : "Zuelen couldn't complete this action. Please try again in a moment.");

  if (!message) return safeFallback;

  const technical =
    technicalPatterns.some((pattern) => pattern.test(message)) ||
    message.length > 260;

  if (technical) {
    console.error("Suppressed technical error from user interface:", message);
    return safeFallback;
  }

  return message;
}
