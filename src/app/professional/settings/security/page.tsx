import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MfaSettings } from "@/components/mfa-settings";
import { ProfessionalFrame } from "@/components/professional-frame";
import { normalizeLocale } from "@/lib/i18n";
import { getProfessionalWorkspace } from "@/lib/professional-workspace";
import styles from "../../professional.module.css";

export const dynamic = "force-dynamic";

export default async function ProfessionalSecurityPage() {
  const { workspace, profile, subscription } = await getProfessionalWorkspace(true);
  if (!profile) return null;
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  return <ProfessionalFrame name={profile.full_name || workspace.profile?.full_name || workspace.email || "Accountant"} firmName={profile.firm_name} email={workspace.email} photoUrl={profile.photo_url} approvalStatus={profile.approval_status} plan={subscription?.tier ?? null} hasBusinessWorkspace={workspace.workspaces.length > 0} locale={locale}><div className={styles.page}><div className={styles.pageHead}><div><span>{fr ? "Paramètres · sécurité" : "Settings · security"}</span><h1>{fr ? "Sécurité du compte" : "Account security"}</h1><p>{fr ? "Protégez votre identité Zuelen et tous les espaces qui y sont rattachés." : "Protect your Zuelen identity and every workspace attached to it."}</p></div><Link className={styles.secondaryLink} href="/professional/settings"><ArrowLeft size={14}/>{fr ? "Paramètres" : "Settings"}</Link></div><MfaSettings locale={locale}/></div></ProfessionalFrame>;
}
