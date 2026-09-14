import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ADMIN_EMAIL = "contact@zuelen.lu";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";

export async function GET() {
  const admin = createAdminClient();
  const redirectTo = APP_URL + "/auth/complete?next=" + encodeURIComponent("/account/password-reset");

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return NextResponse.json({ ok: false }, { status: 500 });

  const existing = usersData.users.find(user => user.email?.toLowerCase() === ADMIN_EMAIL);
  if (existing) return NextResponse.json({ ok: true, mode: "already_exists" });

  const { error } = await admin.auth.admin.inviteUserByEmail(ADMIN_EMAIL, {
    redirectTo,
    data: { locale: "en", z_admin: true },
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, mode: "invite_sent" });
}
