import { PremiumRouteGate } from "@/components/premium-route-gate";

export default function EcdfLayout({ children }: { children: React.ReactNode }) {
  return (
    <PremiumRouteGate
      title="Unlock eCDF preparation"
      titleFr="Débloquez la préparation eCDF"
      description="Premium unlocks the annual-accounts and eCDF workflow, including preparation checks and filing-ready outputs."
      descriptionFr="Premium débloque le flux des comptes annuels et eCDF, y compris les contrôles de préparation et les sorties prêtes au dépôt."
      features={["eCDF preparation", "Annual-account checks", "Structured outputs", "Year-end workflow"]}
      featuresFr={["Préparation eCDF", "Contrôles des comptes annuels", "Sorties structurées", "Flux de clôture"]}
    >{children}</PremiumRouteGate>
  );
}
