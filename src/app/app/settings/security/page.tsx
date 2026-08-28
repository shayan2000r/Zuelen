import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { MfaSettings } from "@/components/mfa-settings";
import { PageHeader, V2Page } from "@/components/zuelen-ui-v2";
import { normalizeLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  return <V2Page><PageHeader eyebrow={fr ? "Paramètres · sécurité" : "Settings · security"} title={fr ? "Sécurité du compte" : "Account security"} description={fr ? "Protégez votre identité Zuelen et tous les espaces qui y sont rattachés." : "Protect your Zuelen identity and every workspace attached to it."} actions={[{ label: fr ? "Paramètres" : "Settings", href: "/app/settings", icon: ArrowLeft, variant: "ghost" }]}/><MfaSettings locale={locale}/></V2Page>;
}
