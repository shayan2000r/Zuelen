export type SelectableWorkspace = { companyId: string };

export function selectActiveWorkspace<T extends SelectableWorkspace>(workspaces: readonly T[], requestedCompanyId: string | null | undefined): T | null {
  const requested = requestedCompanyId ? workspaces.find(item => item.companyId === requestedCompanyId) : null;
  if (requested) return requested;
  return workspaces.length === 1 ? workspaces[0] : null;
}
