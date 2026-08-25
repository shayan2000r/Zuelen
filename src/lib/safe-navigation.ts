const INTERNAL_ORIGIN = "https://zuelen.invalid";

export function safeInternalDestination(value: string | null | undefined) {
  if (!value || value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return null;
    const destination = new URL(value, INTERNAL_ORIGIN);
    if (destination.origin !== INTERNAL_ORIGIN) return null;
    if (destination.pathname === "/sign-in" || destination.pathname.startsWith("/sign-in/") || destination.pathname === "/auth" || destination.pathname.startsWith("/auth/")) return null;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}
