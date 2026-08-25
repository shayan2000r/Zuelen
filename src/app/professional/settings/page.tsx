import Link from "next/link";
import { AlertTriangle, Bell, Building2, Check, Globe2, ShieldCheck, Trash2 } from "lucide-react";
import { ProfessionalFrame } from "@/components/professional-frame";
import { normalizeLocale } from "@/lib/i18n";
import { getProfessionalWorkspace } from "@/lib/professional-workspace";
import { deleteProfessionalProfileAction, saveProfessionalSettingsAction } from "./actions";
import styles from "../professional.module.css";
import settings from "./settings.module.css";

export const dynamic = "force-dynamic";

export default async function ProfessionalSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { workspace, profile, subscription, supabase } = await getProfessionalWorkspace(true);
  if (!profile || !workspace.userId) return null;
  const params = await searchParams;
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const { data: preference } = await supabase.from("user_profiles").select("professional_email_updates,locale").eq("user_id", workspace.userId).maybeSingle();
  const optionalUpdates = preference?.professional_email_updates ?? true;
  const deletionBlocked = Boolean(subscription && ["active", "trialing", "past_due"].includes(subscription.status));

  return <ProfessionalFrame
    name={profile.full_name || workspace.profile?.full_name || workspace.email || "Accountant"}
    firmName={profile.firm_name}
    email={workspace.email}
    photoUrl={profile.photo_url}
    approvalStatus={profile.approval_status}
    plan={subscription?.tier ?? null}
    hasBusinessWorkspace={workspace.workspaces.length > 0}
    locale={locale}
  >
    <div className={styles.page}>
      <div className={styles.pageHead}><div><span>{l("Professional account", "Compte professionnel")}</span><h1>{l("Settings", "Paramètres")}</h1><p>{l("Manage language, optional communications and the professional workspace attached to your Zuelen login.", "Gérez la langue, les communications facultatives et l’espace professionnel rattaché à votre compte Zuelen.")}</p></div></div>

      {params.saved ? <div className={styles.notice}><Check size={15}/>{l("Settings saved.", "Paramètres enregistrés.")}</div> : null}
      {params.error === "confirmation" ? <div className={`${styles.notice} ${styles.warning}`}><AlertTriangle size={15}/>{l("Type DELETE exactly to confirm professional profile deletion.", "Saisissez exactement DELETE pour confirmer la suppression du profil professionnel.")}</div> : null}
      {params.error === "subscription" ? <div className={`${styles.notice} ${styles.warning}`}><AlertTriangle size={15}/>{l("Your directory subscription is still open. Cancel it from Subscription & billing before deleting the professional profile.", "Votre abonnement à l’annuaire est encore actif. Annulez-le dans Abonnement & facturation avant de supprimer le profil professionnel.")}</div> : null}

      <form action={saveProfessionalSettingsAction} className={`${styles.card} ${settings.settingsForm}`}>
        <div className={settings.settingsSection}>
          <div className={settings.settingsIcon}><Globe2 size={18}/></div>
          <div className={settings.settingsCopy}><h2>{l("Language", "Langue")}</h2><p>{l("Choose the language used across your professional workspace and service emails.", "Choisissez la langue utilisée dans votre espace professionnel et dans les e-mails de service.")}</p></div>
          <select name="locale" defaultValue={locale} className={settings.settingsSelect} aria-label={l("Language", "Langue")}><option value="en">English</option><option value="fr">Français</option></select>
        </div>

        <div className={settings.settingsDivider}/>

        <div className={settings.settingsSection}>
          <div className={settings.settingsIcon}><Bell size={18}/></div>
          <div className={settings.settingsCopy}><h2>{l("Email notifications", "Notifications par e-mail")}</h2><p>{l("Receive optional directory and Zuelen professional product updates.", "Recevez les actualités facultatives de l’annuaire et du produit Zuelen Professionals.")}</p><small><ShieldCheck size={13}/>{l("Review decisions, billing and security emails are essential service messages and are always sent.", "Les décisions de vérification, la facturation et les e-mails de sécurité sont des messages de service essentiels et sont toujours envoyés.")}</small></div>
          <label className={settings.settingsToggle}><input type="checkbox" name="professional_email_updates" defaultChecked={optionalUpdates}/><span aria-hidden="true"/><em>{optionalUpdates ? l("On", "Activé") : l("Off", "Désactivé")}</em></label>
        </div>

        <div className={settings.settingsFooter}><button className={styles.primary} type="submit">{l("Save settings", "Enregistrer")}</button></div>
      </form>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span>{l("Workspaces", "Espaces")}</span><h2>{l("One login, separate workspaces", "Un compte, plusieurs espaces")}</h2></div><Building2 size={19}/></div>
        <div className={settings.workspaceSetting}>
          <div><strong>{l("Business workspace", "Espace entreprise")}</strong><p>{workspace.company ? l("Your Zuelen login already has a business workspace. You can switch between business and professional from the account menu.", "Votre compte Zuelen possède déjà un espace entreprise. Vous pouvez passer de l’espace entreprise à l’espace professionnel depuis le menu du compte.") : l("Create a business workspace with the same email and login. Your professional profile stays separate.", "Créez un espace entreprise avec le même e-mail et le même compte. Votre profil professionnel restera séparé.")}</p></div>
          <Link href={workspace.workspaces.length ? "/contexts" : "/setup?add=1"} className={styles.secondaryLink}>{workspace.workspaces.length ? l("Open my Zuelen activities", "Ouvrir mes activités Zuelen") : l("Create an activity", "Créer une activité")}</Link>
        </div>
      </section>

      <section className={`${styles.card} ${settings.dangerCard}`}>
        <div className={styles.sectionHead}><div><span>{l("Danger zone", "Zone sensible")}</span><h2>{l("Delete professional profile", "Supprimer le profil professionnel")}</h2></div><Trash2 size={19}/></div>
        <p>{l("This removes your accountant listing, profile information and directory analytics. It does not delete a business workspace attached to the same Zuelen login.", "Cette action supprime votre profil comptable, ses informations et ses statistiques d’annuaire. Elle ne supprime pas un éventuel espace entreprise rattaché au même compte Zuelen.")}</p>
        {deletionBlocked ? <div className={settings.dangerBlocked}><AlertTriangle size={16}/><div><strong>{l("Subscription must be closed first", "L’abonnement doit d’abord être clôturé")}</strong><span>{l("Open Subscription & billing to cancel the directory subscription. Deletion is available once the billable subscription has ended.", "Ouvrez Abonnement & facturation pour annuler l’abonnement à l’annuaire. La suppression sera disponible une fois l’abonnement facturable terminé.")}</span></div><Link href="/professional/billing" className={styles.secondaryLink}>{l("Open billing", "Ouvrir la facturation")}</Link></div> : <form action={deleteProfessionalProfileAction} className={settings.deleteForm}><label><span>{l("Type DELETE to confirm", "Saisissez DELETE pour confirmer")}</span><input name="confirmation" autoComplete="off" placeholder="DELETE" required/></label><button type="submit" className={settings.dangerButton}><Trash2 size={14}/>{l("Delete professional profile", "Supprimer le profil professionnel")}</button></form>}
      </section>
    </div>
  </ProfessionalFrame>;
}
