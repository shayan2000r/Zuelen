import { redirect } from "next/navigation";
import { hasPremiumAccess } from "@/lib/billing";
import { getWorkspace } from "@/lib/workspace";
import { PremiumLock } from "./premium-lock";

export async function PremiumRouteGate({
  children,
  title,
  titleFr,
  description,
  descriptionFr,
  features,
  featuresFr,
}: {
  children: React.ReactNode;
  title: string;
  titleFr: string;
  description: string;
  descriptionFr: string;
  features: string[];
  featuresFr: string[];
}) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.organization) redirect("/setup");
  const premium = await hasPremiumAccess(workspace.organization.id);
  if (premium) return <>{children}</>;
  const locale = workspace.profile?.locale === "fr" ? "fr" : "en";
  return (
    <div style={{ padding: 26 }}>
      <PremiumLock
        locale={locale}
        title={locale === "fr" ? titleFr : title}
        description={locale === "fr" ? descriptionFr : description}
        features={locale === "fr" ? featuresFr : features}
      />
    </div>
  );
}
