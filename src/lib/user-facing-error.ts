import "server-only";\nimport { sanitizePublicErrorMessage } from "@/lib/public-error-message";

type Locale = "en" | "fr";

function extractMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    return typeof value === "string" ? value : "";
  }
  return typeof error === "string" ? error : "";
}


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
