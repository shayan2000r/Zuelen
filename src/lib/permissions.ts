export type OrganizationRole = "owner" | "admin" | "accountant" | "bookkeeper" | "viewer";

export function canBookkeep(role: OrganizationRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "accountant" || role === "bookkeeper";
}

export function canAccount(role: OrganizationRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "accountant";
}

export function canManageOrganization(role: OrganizationRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function prettyRole(role: OrganizationRole | null | undefined) {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}
