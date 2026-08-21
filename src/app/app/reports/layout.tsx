import { PremiumRouteGate } from "@/components/premium-route-gate";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PremiumRouteGate
      title="Unlock financial reports"
      titleFr="Débloquez les rapports financiers"
      description="Reports stay visible on Basic so you can see what Zuelen can do. Premium unlocks the live figures, statements and financial analytics for your company."
      descriptionFr="Les rapports restent visibles avec Basic afin que vous puissiez découvrir les possibilités de Zuelen. Premium débloque les chiffres, états et analyses financières de votre entreprise."
      features={["Profit & loss", "Balance sheet", "Financial analytics", "Trial balance"]}
      featuresFr={["Compte de résultat", "Bilan", "Analyses financières", "Balance générale"]}
    >{children}</PremiumRouteGate>
  );
}
