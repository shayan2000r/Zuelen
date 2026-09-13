import { NextResponse } from "next/server";
import { earlyAccessPublicUrl, isEarlyAccessAllowed, markEarlyAccessActivated } from "@/lib/early-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const allowed = await isEarlyAccessAllowed(user.email);
    if (!allowed) {
      await supabase.auth.signOut();
      try {
        const admin = createAdminClient();
        await admin.auth.admin.deleteUser(user.id);
      } catch (deleteError) {
        console.error("Early access unauthorized-user cleanup failed", deleteError);
      }
      const locale = user.user_metadata?.locale === "fr" ? "fr" : "en";
      return NextResponse.json({ ok: false, redirect: earlyAccessPublicUrl(locale) }, { status: 403 });
    }

    await markEarlyAccessActivated(user.email);
    return NextResponse.json({ ok: true });
  } catch (accessError) {
    console.error("Early access activation check failed", accessError);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
