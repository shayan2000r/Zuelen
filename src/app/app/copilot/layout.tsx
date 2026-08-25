import { PremiumRouteGate } from "@/components/premium-route-gate";

export default function CopilotLayout({ children }: { children: React.ReactNode }) {
  return (
    <PremiumRouteGate
      title="Unlock Zuelen Copilot"
      titleFr="Débloquez Zuelen Copilot"
      description="Ask questions about your books, tax position and deadlines with workspace-aware assistance. Copilot is included with Premium."
      descriptionFr="Posez des questions sur votre comptabilité, votre situation fiscale et vos échéances avec une assistance adaptée à votre espace. Copilot est inclus avec Premium."
      features={["Workspace-aware answers", "Accounting guidance", "Applicable tax & VAT context", "Compliance assistance"]}
      featuresFr={["Réponses contextualisées", "Aide comptable", "Contexte fiscal & TVA", "Assistance conformité"]}
    >{children}</PremiumRouteGate>
  );
}
