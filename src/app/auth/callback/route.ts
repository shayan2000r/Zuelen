import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUserRequiresMfa } from "@/lib/mfa-assurance";
import { earlyAccessPublicUrl, isEarlyAccessAllowed, markEarlyAccessActivated } from "@/lib/early-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeInternalDestination } from "@/lib/auth-destination";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const safeNext = safeInternalDestination(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user?.email) {
        try {
          if (!(await isEarlyAccessAllowed(user.email))) {
            await supabase.auth.signOut();
            try { await createAdminClient().auth.admin.deleteUser(user.id); } catch (deleteError) { console.error("Unauthorized OAuth user cleanup failed", deleteError); }
            const locale = user.user_metadata?.locale === "fr" ? "fr" : "en";
            return NextResponse.redirect(earlyAccessPublicUrl(locale));
          }
          await markEarlyAccessActivated(user.email);
        } catch (accessError) {
          console.error("Early access callback check failed", accessError);
          return NextResponse.redirect(new URL("/sign-in?error=access", request.url));
        }
      }
      if (safeNext === "/account/password-reset") return NextResponse.redirect(new URL(safeNext, request.url));
      if (await currentUserRequiresMfa(supabase)) {
        const challengeUrl = new URL("/auth/mfa", request.url);
        if (safeNext) challengeUrl.searchParams.set("next", safeNext);
        return NextResponse.redirect(challengeUrl);
      }
      if (!safeNext) return NextResponse.redirect(new URL("/auth/resolve", request.url));
      const confirmedUrl = new URL("/auth/confirmed", request.url);
      confirmedUrl.searchParams.set("next", safeNext);
      return NextResponse.redirect(confirmedUrl);
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=confirmation", request.url));
}
