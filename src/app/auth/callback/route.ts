import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalDestination } from "@/lib/auth-destination";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const safeNext = safeInternalDestination(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (!safeNext) return NextResponse.redirect(new URL("/auth/resolve", request.url));
      if (safeNext === "/account/password-reset") return NextResponse.redirect(new URL(safeNext, request.url));
      const confirmedUrl = new URL("/auth/confirmed", request.url);
      confirmedUrl.searchParams.set("next", safeNext);
      return NextResponse.redirect(confirmedUrl);
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=confirmation", request.url));
}
