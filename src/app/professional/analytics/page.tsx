import Link from "next/link";
import { BarChart3, Eye, Globe2, Mail, MousePointerClick, Phone, Sparkles } from "lucide-react";
import { ProfessionalFrame } from "@/components/professional-frame";
import { normalizeLocale } from "@/lib/i18n";
import { DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES, getProfessionalWorkspace } from "@/lib/professional-workspace";
import styles from "../professional.module.css";

export const dynamic = "force-dynamic";

export default async function ProfessionalAnalyticsPage() {
  const { workspace, supabase, profile, subscription } = await getProfessionalWorkspace(true);
  if (!profile) return null;
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const premium = subscription?.tier === "premium" && DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES.has(subscription.status);
  const analytics = { view: 0, email: 0, phone: 0, website: 0 };

  if (premium) {
    const { data: events, error } = await supabase.from("accountant_profile_events").select("event_type").eq("profile_id", profile.id);
    if (error) throw new Error(error.message);
    for (const event of events ?? []) {
      const key = event.event_type as keyof typeof analytics;
      if (key in analytics) analytics[key] += 1;
    }
  }

  const contactClicks = analytics.email + analytics.phone + analytics.website;
  const engagementRate = analytics.view > 0 ? Math.round((contactClicks / analytics.view) * 100) : 0;

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
      <div className={styles.pageHead}><div><span>{l("Performance", "Performance")}</span><h1>{l("Analytics", "Statistiques")}</h1><p>{l("See how businesses discover and engage with your professional listing.", "Découvrez comment les entreprises consultent et utilisent votre profil professionnel.")}</p></div></div>

      {premium ? <>
        <section className={styles.analyticsHero}>
          <div><span><BarChart3 size={15}/>{l("Listing performance", "Performance du profil")}</span><h2>{l("Understand what turns profile visits into enquiries.", "Comprenez ce qui transforme les visites en prises de contact.")}</h2><p>{l("All activity below comes from your approved Zuelen directory listing.", "Toutes les activités ci-dessous proviennent de votre profil approuvé dans l’annuaire Zuelen.")}</p></div>
          <div className={styles.engagementBadge}><strong>{engagementRate}%</strong><span>{l("engagement rate", "taux d’engagement")}</span></div>
        </section>

        <section className={styles.analyticsCards}>
          <article><span className={styles.analyticsIcon}><Eye size={18}/></span><div><small>{l("Profile views", "Vues du profil")}</small><strong>{analytics.view}</strong><p>{l("Visits to your full professional profile", "Visites de votre profil professionnel complet")}</p></div></article>
          <article><span className={styles.analyticsIcon}><MousePointerClick size={18}/></span><div><small>{l("Contact clicks", "Clics de contact")}</small><strong>{contactClicks}</strong><p>{l("Email, phone and website actions combined", "Actions e-mail, téléphone et site combinées")}</p></div></article>
          <article><span className={styles.analyticsIcon}><Mail size={18}/></span><div><small>{l("Email clicks", "Clics e-mail")}</small><strong>{analytics.email}</strong><p>{l("Businesses choosing to email you", "Entreprises ayant choisi de vous écrire")}</p></div></article>
          <article><span className={styles.analyticsIcon}><Phone size={18}/></span><div><small>{l("Phone clicks", "Clics téléphone")}</small><strong>{analytics.phone}</strong><p>{l("Businesses choosing to call you", "Entreprises ayant choisi de vous appeler")}</p></div></article>
          <article><span className={styles.analyticsIcon}><Globe2 size={18}/></span><div><small>{l("Website clicks", "Clics vers le site")}</small><strong>{analytics.website}</strong><p>{l("Visitors continuing to your website", "Visiteurs poursuivant vers votre site")}</p></div></article>
        </section>

        <section className={`${styles.card} ${styles.analyticsInsight}`}><div className={styles.sectionHead}><div><span>{l("Insight", "Analyse")}</span><h2>{l("Your directory funnel", "Votre parcours dans l’annuaire")}</h2></div><BarChart3 size={19}/></div><div className={styles.funnel}><div><strong>{analytics.view}</strong><span>{l("Profile views", "Vues")}</span></div><i>→</i><div><strong>{contactClicks}</strong><span>{l("Contact actions", "Actions de contact")}</span></div><i>→</i><div><strong>{engagementRate}%</strong><span>{l("Engagement", "Engagement")}</span></div></div></section>
      </> : <section className={`${styles.card} ${styles.analyticsLocked}`}><span><Sparkles size={22}/></span><div><h2>{l("Analytics are a Premium feature", "Les statistiques sont une fonctionnalité Premium")}</h2><p>{l("Upgrade to Premium to measure profile views, email clicks, phone clicks, website visits and overall engagement from your directory listing.", "Passez à Premium pour mesurer les vues du profil, les clics e-mail et téléphone, les visites du site et l’engagement global depuis votre profil.")}</p><Link href="/professional/billing" className={styles.primaryLink}>{l("See Premium", "Voir Premium")}</Link></div></section>}
    </div>
  </ProfessionalFrame>;
}
