export type WorkspaceEntityKind = "independent" | "company";

export type WorkspaceCapabilityInput = {
  entityKind: WorkspaceEntityKind;
  vatRegistered: boolean;
  rcsNumber?: string | null;
  businessPermitNumber?: string | null;
};

export type WorkspaceCapabilities = {
  hasAccounting: true;
  hasCcss: true;
  hasReports: true;
  hasDocuments: true;
  hasCorporateTaxes: boolean;
  hasPersonalTaxProfile: boolean;
  hasVat: boolean;
  hasCompanyYearEnd: boolean;
  hasEcdf: boolean;
  hasRcsRegistration: boolean;
  hasBusinessPermit: boolean;
};

export function getWorkspaceCapabilities(input: WorkspaceCapabilityInput): WorkspaceCapabilities {
  const company = input.entityKind === "company";
  return {
    hasAccounting: true,
    hasCcss: true,
    hasReports: true,
    hasDocuments: true,
    hasCorporateTaxes: company,
    hasPersonalTaxProfile: !company,
    hasVat: company || input.vatRegistered,
    hasCompanyYearEnd: company,
    hasEcdf: company,
    hasRcsRegistration: Boolean(input.rcsNumber),
    hasBusinessPermit: Boolean(input.businessPermitNumber),
  };
}

export function isCompanyOnlyPath(pathname: string) {
  return pathname === "/app/year-end"
    || pathname.startsWith("/app/year-end/")
    || pathname === "/app/ecdf"
    || pathname.startsWith("/app/ecdf/");
}
