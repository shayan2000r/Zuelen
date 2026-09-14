import "server-only";

import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const ZUELEN_ADMIN_EMAIL = "contact@zuelen.lu";

export async function requireZuelenAdmin(next = "/admin") {
  const supabase = await createClient();
  let claimsData;
  try {
    ({ data: claimsData } = await supabase.auth.getClaims());
  } catch {
    redirect("/sign-in?next=" + encodeURIComponent(next));
  }

  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : null;

  if (!userId || !email) redirect("/sign-in?next=" + encodeURIComponent(next));
  if (email !== ZUELEN_ADMIN_EMAIL) notFound();

  return { userId, email, admin: createAdminClient() };
}
