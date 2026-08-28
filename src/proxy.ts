import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_HOST = "zuelen.lu";
const APP_HOST = "app.zuelen.lu";
const LEGACY_PUBLIC_HOSTS = new Set(["zuelen.com", "www.zuelen.com", "www.zuelen.lu"]);

function requestHost(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded?.split(",")[0]?.trim() || request.headers.get("host") || "";
  return host.split(":")[0].toLowerCase();
}

function permanentRedirect(request: NextRequest, hostname: string, pathname?: string) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = hostname;
  url.port = "";
  if (pathname) url.pathname = pathname;
  return NextResponse.redirect(url, 308);
}

export async function proxy(request: NextRequest) {
  const host = requestHost(request);

  // Canonical public domain: all .com and www traffic resolves to z URL on .lu.
  if (LEGACY_PUBLIC_HOSTS.has(host)) {
    return permanentRedirect(request, PUBLIC_HOST);
  }

  // The application lives on app.zuelen.lu. Its bare host opens the dashboard.
  // This becomes active as soon as the custom subdomain is attached in Vercel.
  if (host === APP_HOST && request.nextUrl.pathname === "/") {
    return permanentRedirect(request, APP_HOST, "/app");
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
