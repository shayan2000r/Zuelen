import { redirect } from "next/navigation";
import { PremiumRouteGate } from "@/components/premium-route-gate";
import { getWorkspace } from "@/lib/workspace";

export default async function YearEndLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace.capabilities?.hasCompanyYearEnd) redirect("/app/taxes?not_applicable=year-end");
  return (
    <PremiumRouteGate
      title="Unlock year-end & annual accounts"
      titleFr="Débloquez la clôture & les comptes annuels"
      description="Basic keeps year-end visible so you know the workflow is available. Premium unlocks closing controls, annual accounts preparation and filing-ready outputs."
      descriptionFr="Basic laisse la clôture visible afin que vous sachiez que ce flux existe. Premium débloque les contrôles de clôture, la préparation des comptes annuels et les sorties prêtes au dépôt."
      features={["Year-end closing", "Annual accounts", "Closing checks", "Filing-ready outputs"]}
      featuresFr={["Clôture annuelle", "Comptes annuels", "Contrôles de clôture", "Sorties prêtes au dépôt"]}
    >{children}</PremiumRouteGate>
  );
}
