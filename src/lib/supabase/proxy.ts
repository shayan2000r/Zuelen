import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { currentUserRequiresMfa } from "@/lib/mfa-assurance";
import { earlyAccessPublicUrl, isEarlyAccessAllowed } from "@/lib/early-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const protectedPath = pathname === "/app" || pathname.startsWith("/app/")
    || pathname === "/professional" || pathname.startsWith("/professional/")
    || pathname === "/contexts" || pathname.startsWith("/contexts/")
    || pathname === "/setup" || pathname.startsWith("/setup/")
    || pathname === "/admin" || pathname.startsWith("/admin/")
    || pathname === "/account" || pathname.startsWith("/account/")
    || pathname === "/accountants/manage" || pathname.startsWith("/accountants/manage/");

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  let claims;
  try {
    ({ data: claims } = await supabase.auth.getClaims());
  } catch {
    const invalidSessionResponse = protectedPath
      ? NextResponse.redirect(new URL("/sign-in", request.url))
      : response;
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
        invalidSessionResponse.cookies.delete(cookie.name);
      }
    }
    return invalidSessionResponse;
  }

  if (claims?.claims?.sub && protectedPath && pathname !== "/auth/mfa") {
    const email = typeof claims.claims.email === "string" ? claims.claims.email : null;
    try {
      if (!(await isEarlyAccessAllowed(email))) {
        const metadata = claims.claims.user_metadata as { locale?: string } | undefined;
        return NextResponse.redirect(earlyAccessPublicUrl(metadata?.locale === "fr" ? "fr" : "en"));
      }
    } catch (error) {
      console.error("Early access gate check failed", error);
      return NextResponse.redirect(new URL("/sign-in?error=access", request.url));
    }

    if (await currentUserRequiresMfa(supabase)) {
      const next = `${pathname}${request.nextUrl.search}`;
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa";
      url.search = "";
      url.searchParams.set("next", next);
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      return redirect;
    }
  }
  return response;
}
