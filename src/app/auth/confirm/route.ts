import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalDestination } from "@/lib/safe-navigation";
import { earlyAccessPublicUrl, isEarlyAccessAllowed, markEarlyAccessActivated } from "@/lib/early-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeInternalDestination(requestUrl.searchParams.get("next")) ?? "/setup";
  const redirectTo = new URL(next, request.url);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user?.email) {
        try {
          if (!(await isEarlyAccessAllowed(user.email))) {
            await supabase.auth.signOut();
            try { await createAdminClient().auth.admin.deleteUser(user.id); } catch (deleteError) { console.error("Unauthorized confirmed user cleanup failed", deleteError); }
            const locale = user.user_metadata?.locale === "fr" ? "fr" : "en";
            return NextResponse.redirect(earlyAccessPublicUrl(locale));
          }
          await markEarlyAccessActivated(user.email);
        } catch (accessError) {
          console.error("Early access confirmation check failed", accessError);
          return NextResponse.redirect(new URL("/sign-in?error=access", request.url));
        }
      }
      return NextResponse.redirect(redirectTo);
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=confirmation", request.url));
}
