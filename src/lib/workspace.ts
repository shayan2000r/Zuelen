import { createClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "@/lib/permissions";

export type Workspace = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  role: OrganizationRole | null;
  profile: { full_name: string | null; avatar_path: string | null } | null;
  organization: { id: string; name: string; slug: string } | null;
  company: {
    id: string;
    legal_name: string;
    trading_name: string | null;
    legal_form: string;
    base_currency: string;
    fiscal_year_start_month: number;
    vat_registered: boolean;
    vat_filing_frequency: string | null;
    vat_number: string | null;
    rcs_number: string | null;
    tax_number: string | null;
    business_permit_number: string | null;
    municipality: string | null;
    activity: string | null;
    brand_image_path: string | null;
    registered_address: Record<string, unknown>;
  } | null;
};

const EMPTY: Workspace = { authenticated:false,userId:null,email:null,role:null,profile:null,organization:null,company:null };

export async function getWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (claimsError || !userId) return EMPTY;

  const email=typeof claims?.email==="string"?claims.email:null;
  const {data:organization}=await supabase.from("organizations").select("id,name,slug").order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(!organization){
    const {data:profile}=await supabase.from("user_profiles").select("full_name,avatar_path").eq("user_id",userId).maybeSingle();
    return{authenticated:true,userId,email,role:null,profile:profile??null,organization:null,company:null};
  }

  const [{data:membership},{data:profile},{data:company}]=await Promise.all([
    supabase.from("organization_members").select("role").eq("organization_id",organization.id).eq("user_id",userId).maybeSingle(),
    supabase.from("user_profiles").select("full_name,avatar_path").eq("user_id",userId).maybeSingle(),
    supabase.from("companies").select("id,legal_name,trading_name,legal_form,base_currency,fiscal_year_start_month,vat_registered,vat_filing_frequency,vat_number,rcs_number,tax_number,business_permit_number,municipality,activity,brand_image_path,registered_address").eq("organization_id",organization.id).order("created_at",{ascending:true}).limit(1).maybeSingle()
  ]);
  const role=(membership?.role??null) as OrganizationRole|null;
  return{authenticated:true,userId,email,role,profile:profile??null,organization,company:company?{...company,registered_address:(company.registered_address??{}) as Record<string,unknown>}:null};
}
