import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "@/lib/permissions";
import { normalizeLocale, type Locale } from "@/lib/i18n";
import { getWorkspaceCapabilities, type WorkspaceCapabilities, type WorkspaceEntityKind } from "@/lib/workspace-capabilities";
import { selectActiveWorkspace } from "@/lib/workspace-selection";

export const ACTIVE_WORKSPACE_COOKIE = "zuelen-active-workspace";

export type EconomicWorkspaceSummary = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  companyId: string;
  displayName: string;
  legalForm: string;
  entityKind: WorkspaceEntityKind;
  role: OrganizationRole;
  vatRegistered: boolean;
};

export type Workspace = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  role: OrganizationRole | null;
  profile: { full_name: string | null; avatar_path: string | null; locale: Locale } | null;
  organization: { id: string; name: string; slug: string } | null;
  company: {
    id: string;
    legal_name: string;
    trading_name: string | null;
    legal_form: string;
    entity_kind: WorkspaceEntityKind;
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
  workspaces: EconomicWorkspaceSummary[];
  capabilities: WorkspaceCapabilities | null;
};

const EMPTY: Workspace = { authenticated:false,userId:null,email:null,role:null,profile:null,organization:null,company:null,workspaces:[],capabilities:null };
function normalizeProfile(profile:{full_name:string|null;avatar_path:string|null;locale:string|null}|null){return profile?{...profile,locale:normalizeLocale(profile.locale)}:null}
type CompanyRow = NonNullable<Workspace["company"]> & { organization_id: string; created_at: string };

export async function getWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  let claimsData;
  let claimsError;
  try {
    ({ data: claimsData, error: claimsError } = await supabase.auth.getClaims());
  } catch {
    return EMPTY;
  }
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (claimsError || !userId) return EMPTY;

  const email = typeof claims?.email === "string" ? claims.email : null;
  const [{ data: memberships, error: membershipError }, { data: profile }] = await Promise.all([
    supabase.from("organization_members").select("organization_id,role,created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("user_profiles").select("full_name,avatar_path,locale").eq("user_id", userId).maybeSingle(),
  ]);
  if (membershipError) throw new Error(membershipError.message);
  const organizationIds = (memberships ?? []).map(item => item.organization_id);
  if (!organizationIds.length) return { ...EMPTY, authenticated:true, userId, email, profile:normalizeProfile(profile) };

  const [{ data: organizations, error: organizationError }, { data: companyRows, error: companyError }] = await Promise.all([
    supabase.from("organizations").select("id,name,slug").in("id", organizationIds),
    supabase.from("companies").select("id,organization_id,legal_name,trading_name,legal_form,entity_kind,base_currency,fiscal_year_start_month,vat_registered,vat_filing_frequency,vat_number,rcs_number,tax_number,business_permit_number,municipality,activity,brand_image_path,registered_address,created_at").in("organization_id", organizationIds).order("created_at", { ascending:true }),
  ]);
  if (organizationError) throw new Error(organizationError.message);
  if (companyError) throw new Error(companyError.message);

  const organizationMap = new Map((organizations ?? []).map(item => [item.id, item]));
  const membershipMap = new Map((memberships ?? []).map(item => [item.organization_id, item]));
  const companies = (companyRows ?? []) as CompanyRow[];
  const summaries: EconomicWorkspaceSummary[] = companies.flatMap(company => {
    const organization = organizationMap.get(company.organization_id);
    const membership = membershipMap.get(company.organization_id);
    if (!organization || !membership) return [];
    return [{
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      companyId: company.id,
      displayName: company.trading_name || company.legal_name,
      legalForm: company.legal_form,
      entityKind: company.entity_kind,
      role: membership.role as OrganizationRole,
      vatRegistered: company.vat_registered,
    }];
  });

  const requestedId = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  const activeSummary = selectActiveWorkspace(summaries, requestedId);
  if (!activeSummary) return { ...EMPTY, authenticated:true, userId, email, profile:normalizeProfile(profile), workspaces:summaries };

  const organization = organizationMap.get(activeSummary.organizationId)!;
  const companyRow = companies.find(item => item.id === activeSummary.companyId)!;
  const company = {
    id:companyRow.id,legal_name:companyRow.legal_name,trading_name:companyRow.trading_name,legal_form:companyRow.legal_form,
    entity_kind:companyRow.entity_kind,base_currency:companyRow.base_currency,fiscal_year_start_month:companyRow.fiscal_year_start_month,
    vat_registered:companyRow.vat_registered,vat_filing_frequency:companyRow.vat_filing_frequency,vat_number:companyRow.vat_number,
    rcs_number:companyRow.rcs_number,tax_number:companyRow.tax_number,business_permit_number:companyRow.business_permit_number,
    municipality:companyRow.municipality,activity:companyRow.activity,brand_image_path:companyRow.brand_image_path,
    registered_address:companyRow.registered_address,
  };
  const capabilities = getWorkspaceCapabilities({ entityKind:company.entity_kind, vatRegistered:company.vat_registered, rcsNumber:company.rcs_number, businessPermitNumber:company.business_permit_number });
  return {
    authenticated:true,userId,email,role:activeSummary.role,profile:normalizeProfile(profile),organization,
    company:{...company,registered_address:(company.registered_address ?? {}) as Record<string,unknown>},
    workspaces:summaries,capabilities,
  };
}
