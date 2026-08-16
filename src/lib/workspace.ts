import { createClient } from "@/lib/supabase/server";

export type Workspace = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  organization: { id: string; name: string; slug: string } | null;
  company: {
    id: string;
    legal_name: string;
    legal_form: string;
    base_currency: string;
    fiscal_year_start_month: number;
    vat_registered: boolean;
    vat_number: string | null;
  } | null;
};

export async function getWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (claimsError || !userId) {
    return {
      authenticated: false,
      userId: null,
      email: null,
      organization: null,
      company: null,
    };
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  const { data: organization } = await supabase
    .from("organizations")
    .select("id,name,slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!organization) {
    return { authenticated: true, userId, email, organization: null, company: null };
  }

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id,legal_name,legal_form,base_currency,fiscal_year_start_month,vat_registered,vat_number",
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    authenticated: true,
    userId,
    email,
    organization,
    company: company ?? null,
  };
}
