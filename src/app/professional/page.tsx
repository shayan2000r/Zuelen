import { BadgeCheck, BarChart3, BriefcaseBusiness, Check, Clock3, CreditCard, ExternalLink, Sparkles, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AccountantOnboarding } from "@/components/accountant-onboarding";
import { ProfessionalFrame } from "@/components/professional-frame";
import { MetricCard, MetricGrid, PageHeader, Panel, SectionHeader, StatusBadge, V2Button, V2Page, V2TwoColumn } from "@/components/zuelen-ui-v2";
import { accountantInitials, accountantStripeConfigured } from "@/lib/accountants";
import { normalizeLocale } from "@/lib/i18n";
import { accountantSubscriptionStatusLabel, accountantTrialDaysLeft, DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES, getProfessionalWorkspace } from "@/lib/professional-workspace";
import styles from "./professional.module.css";

export const dynamic = "force-dynamic";

type Params = { step?: string; checkout?: string };

export default async function ProfessionalPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { workspace, supabase, profile, subscription } = await getProfessionalWorkspace(false);
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;

  if (!profile) {
    return <AccountantOnboarding
      email={workspace.email}
      profile={null}
      subscription={null}
      stripeConfigured={accountantStripeConfigured()}
      initialStep={1}
      checkoutStatus={params.checkout ?? null}
    />;
  }

  if (params.step === "3" && !subscription) {
    return <AccountantOnboarding
      email={workspace.email}
      profile={profile}
      subscription={null}
      stripeConfigured={accountantStripeConfigured()}
      initialStep={3}
      checkoutStatus={params.checkout ?? null}
    />;
  }

  if (!subscription && params.checkout !== "success") redirect("/professional?step=3");

  const analytics = { view: 0, email: 0, phone: 0, website: 0 };
  if (subscription?.tier === "premium" && DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES.has(subscription.status)) {
    const { data: events, error } = await supabase.from("accountant_profile_events").select("event_type").eq("profile_id", profile.id);
    if (error) throw new Error(error.message);
    for (const event of events ?? []) {
      const key = event.event_type as keyof typeof analytics;
      if (key in analytics) analytics[key] += 1;
    }
  }

  const trialDays = accountantTrialDaysLeft(subscription?.trial_end);
  const live = profile.approval_status === "approved" && Boolean(subscription && DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES.has(subscription.status));
  const firstName = profile.full_name.split(/\s+/).filter(Boolean)[0] || l("there", "bonjour");
  const approvalLabel = profile.approval_status === "approved" ? l("Approved", "Approuvé") : profile.approval_status === "pending" ? l("Pending review", "En cours de vérification") : l("Changes required", "Modifications requises");
  const approvalDescription = live ? l("Visible in the directory", "Visible dans l’annuaire") : profile.approval_status === "pending" ? l("Waiting for Zuelen review", "En attente de vérification par Zuelen") : l("Not currently public", "Non visible actuellement");
  const billingLabel = subscription?.status === "trialing" ? l("Free Trial", "Essai gratuit") : subscription?.status === "active" ? l("Active", "Actif") : subscription?.status === "past_due" ? l("Payment issue", "Problème de paiement") : accountantSubscriptionStatusLabel(subscription?.status);
  const completenessChecks = [profile.full_name, profile.professional_title, profile.location, profile.photo_url, profile.languages?.length, profile.specialties?.length];
  const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

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
    <V2Page>
      <PageHeader
        eyebrow={l("Professional workspace", "Espace professionnel")}
        title={fr ? `Bonjour, ${firstName}.` : `Good to see you, ${firstName}.`}
        description={l("Manage your public presence, track performance and keep your Zuelen listing ready for businesses to discover.", "Gérez votre présence publique, suivez vos performances et gardez votre profil Zuelen prêt à être découvert par les entreprises.")}
        actions={[
          { label: l("View directory", "Voir l’annuaire"), href: "/accountants/directory", icon: ExternalLink, variant: "primary" },
          { label: l("Edit profile", "Modifier le profil"), href: "/professional/profile", icon: UserRound, variant: "secondary" },
        ]}
      />

      {params.checkout === "success" ? <div className={styles.notice}><Check size={15}/> {l("Subscription received. Your billing status will update automatically as Stripe finishes syncing.", "Abonnement reçu. Votre statut de facturation sera mis à jour automatiquement dès la synchronisation Stripe terminée.")}</div> : null}

      <MetricGrid>
        <MetricCard label={l("Listing status", "Statut du profil")} value={approvalLabel} description={approvalDescription} icon={profile.approval_status === "approved" ? BadgeCheck : Clock3} href="/professional/profile"/>
        <MetricCard label={l("Directory plan", "Formule annuaire")} value={subscription ? (subscription.tier === "premium" ? "Premium" : "Basic") : l("Syncing", "Synchronisation")} description={subscription ? l("Manage your plan and payment settings.", "Gérez votre formule et vos paramètres de paiement.") : l("Stripe is finishing setup.", "Stripe termine la configuration.")} icon={BriefcaseBusiness} href="/professional/billing"/>
        <MetricCard label={l("Billing status", "Statut de facturation")} value={billingLabel} description={subscription?.status === "trialing" && trialDays !== null ? (fr ? `${trialDays} jour${trialDays === 1 ? "" : "s"} restant${trialDays === 1 ? "" : "s"} dans votre essai gratuit.` : `${trialDays} day${trialDays === 1 ? "" : "s"} remaining in your free trial.`) : subscription?.current_period_end ? `${l("Next billing", "Prochaine facturation")} ${new Date(subscription.current_period_end).toLocaleDateString(fr ? "fr-FR" : "en-GB")}` : l("No billing action required.", "Aucune action requise.")} icon={CreditCard} href="/professional/billing"/>
        <MetricCard label={l("Profile completeness", "Profil complété")} value={`${completeness}%`} description={completeness === 100 ? l("Your essential directory details are complete.", "Vos informations essentielles sont complètes.") : l("Complete the remaining details to strengthen your listing.", "Complétez les informations restantes pour renforcer votre profil.")} icon={UserRound} href="/professional/profile"/>
      </MetricGrid>

      <div style={{height:"var(--z-space-7)"}}/>

      <V2TwoColumn>
        <Panel>
          <SectionHeader eyebrow={l("Your listing", "Votre profil")} title={l("Professional profile", "Profil professionnel")} description={l("The identity businesses see when they discover you in the directory.", "L’identité que les entreprises voient lorsqu’elles vous découvrent dans l’annuaire.")} action={<StatusBadge tone={profile.approval_status === "approved" ? "success" : profile.approval_status === "pending" ? "warning" : "danger"}>{approvalLabel}</StatusBadge>}/>
          <div className={styles.profileSummary}>
            {profile.photo_url ? <img src={profile.photo_url} alt=""/> : <span className={styles.profileAvatar}>{accountantInitials(profile.full_name)}</span>}
            <div><h3>{profile.full_name}</h3><p>{profile.professional_title}{profile.firm_name ? ` · ${profile.firm_name}` : ""}</p><small>{profile.location || "Luxembourg"} · {profile.languages.slice(0,3).join(" · ")}</small></div>
          </div>
          <div className={styles.chips}>{profile.specialties.slice(0,5).map(item => <span key={item}>{item}</span>)}</div>
          <div className={styles.cardActions}><V2Button label={l("Edit profile", "Modifier le profil")} href="/professional/profile" variant="primary"/><V2Button label={l("Browse directory", "Parcourir l’annuaire")} href="/accountants/directory" variant="secondary"/></div>
        </Panel>

        <Panel>
          <SectionHeader eyebrow={l("Next step", "Prochaine étape")} title={profile.approval_status === "approved" ? l("Your listing is approved", "Votre profil est approuvé") : profile.approval_status === "pending" ? l("Review in progress", "Vérification en cours") : l("Your listing needs attention", "Votre profil nécessite une modification")}/>
          <div className={styles.nextStep}>
            <div><span className={styles.nextIcon}>{profile.approval_status === "approved" ? <BadgeCheck size={18}/> : <Clock3 size={18}/>}</span><p>{profile.approval_status === "approved" ? (live ? l("Businesses can discover your profile in the Zuelen directory.", "Les entreprises peuvent découvrir votre profil dans l’annuaire Zuelen.") : l("Your profile is approved. An eligible subscription is required for directory visibility.", "Votre profil est approuvé. Un abonnement éligible est nécessaire pour être visible dans l’annuaire.")) : profile.approval_status === "pending" ? l("No action is required right now. Zuelen will review the profile before it becomes public.", "Aucune action n’est requise pour le moment. Zuelen vérifiera votre profil avant sa publication.") : profile.rejection_reason || l("Review your profile details and make the requested changes.", "Vérifiez votre profil et effectuez les modifications demandées.")}</p></div>
            <V2Button label={profile.approval_status === "pending" ? l("Review my details", "Vérifier mes informations") : l("Open my profile", "Ouvrir mon profil")} href="/professional/profile" variant="secondary"/>
          </div>
        </Panel>
      </V2TwoColumn>

      <div style={{height:"var(--z-space-7)"}}/>

      <Panel>
        <SectionHeader eyebrow={l("Performance", "Performance")} title={l("Listing analytics", "Statistiques du profil")} description={l("Understand how businesses discover and interact with your directory presence.", "Comprenez comment les entreprises découvrent et utilisent votre présence dans l’annuaire.")} action={<V2Button label={l("Open analytics", "Ouvrir les statistiques")} href="/professional/analytics" icon={BarChart3} variant="ghost"/>}/>
        {subscription?.tier === "premium" && DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES.has(subscription.status) ? <div className={styles.analyticsGrid}><div><strong>{analytics.view}</strong><span>{l("Profile views", "Vues du profil")}</span></div><div><strong>{analytics.email + analytics.phone}</strong><span>{l("Contact clicks", "Clics de contact")}</span></div><div><strong>{analytics.website}</strong><span>{l("Website clicks", "Clics vers le site")}</span></div></div> : <div className={styles.locked}><Sparkles size={18}/><div><strong>{l("Analytics are included with Premium.", "Les statistiques sont incluses avec Premium.")}</strong><p>{l("Upgrade whenever you want to measure profile views and the actions businesses take from your listing.", "Passez à Premium pour mesurer les vues et les actions effectuées depuis votre profil.")}</p></div><V2Button label={l("See Premium", "Voir Premium")} href="/professional/billing" variant="secondary"/></div>}
      </Panel>
    </V2Page>
  </ProfessionalFrame>;
}
