"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeInternalDestination } from "@/lib/safe-navigation";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";

export async function switchWorkspaceAction(formData: FormData) {
  const companyId = String(formData.get("company_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/app");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) redirect("/contexts?error=workspace");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/sign-in");
  const { data: company } = await supabase.from("companies").select("id,organization_id").eq("id", companyId).maybeSingle();
  if (!company) redirect("/contexts?error=workspace");
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("organization_id", company.organization_id).eq("user_id", claims.claims.sub).maybeSingle();
  if (!membership) redirect("/contexts?error=workspace");
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, companyId, { httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production", path:"/", maxAge:60 * 60 * 24 * 365 });
  const safeReturn = safeInternalDestination(returnTo) ?? "/app";
  redirect(safeReturn);
}
