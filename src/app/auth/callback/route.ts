import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/setup";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/setup";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const confirmedUrl = new URL("/auth/confirmed", request.url);
      confirmedUrl.searchParams.set("next", safeNext);
      return NextResponse.redirect(confirmedUrl);
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=confirmation", request.url));
}
