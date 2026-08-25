export function chooseContextDestination(input: {
  hasActiveEconomicWorkspace: boolean;
  economicWorkspaceCount: number;
  hasProfessionalProfile: boolean;
}) {
  if (input.hasActiveEconomicWorkspace) return "/app";
  if (input.economicWorkspaceCount > 1 || input.economicWorkspaceCount > 0 && input.hasProfessionalProfile) return "/contexts";
  if (input.economicWorkspaceCount === 1) return "/app";
  if (input.hasProfessionalProfile) return "/professional";
  return "/setup";
}
