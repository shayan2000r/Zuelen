import { Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { ProfessionalFrame } from "@/components/professional-frame";
import { accountantStripeConfigured } from "@/lib/accountants";
import { normalizeLocale } from "@/lib/i18n";
import { ACTIVE_ACCOUNTANT_SUBSCRIPTION_STATUSES, accountantTrialDaysLeft, getProfessionalWorkspace } from "@/lib/professional-workspace";
import { createAccountantPortalAction, startAccountantTrialAction } from "@/app/accountants/manage/actions";
import styles from "../professional.module.css";

export const dynamic = "force-dynamic";

export default async function ProfessionalBillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string }> }) {
  const { workspace, profile, subscription } = await getProfessionalWorkspace(true);
  const params = await searchParams;
  if (!profile) return null;
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;

  const configured = accountantStripeConfigured();
  const subscriptionOpen = Boolean(subscription && ACTIVE_ACCOUNTANT_SUBSCRIPTION_STATUSES.has(subscription.status));
  const trialUsed = Boolean(subscription?.trial_end);
  const trialDays = accountantTrialDaysLeft(subscription?.trial_end);
  const basicLabel = subscriptionOpen
    ? subscription?.tier === "basic" ? l("Current plan", "Formule actuelle") : l("Change to Basic", "Passer à Basic")
    : trialUsed ? l("Subscribe to Basic", "S’abonner à Basic") : l("Start Basic trial", "Commencer l’essai Basic");
  const premiumLabel = subscriptionOpen
    ? subscription?.tier === "premium" ? l("Current plan", "Formule actuelle") : l("Upgrade to Premium", "Passer à Premium")
    : trialUsed ? l("Subscribe to Premium", "S’abonner à Premium") : l("Start Premium trial", "Commencer l’essai Premium");
  const statusLabel = subscription?.status === "trialing" ? l("Free Trial", "Essai gratuit") : subscription?.status === "active" ? l("Active", "Actif") : subscription?.status === "past_due" ? l("Payment issue", "Problème de paiement") : subscription?.status === "canceled" ? l("Cancelled", "Annulé") : l("Not started", "Non démarré");

  return <ProfessionalFrame
    name={profile.full_name || workspace.profile?.full_name || workspace.email || "Accountant"}
    firmName={profile.firm_name}
    email={workspace.email}
    photoUrl={profile.photo_url}
    approvalStatus={profile.approval_status}
    plan={subscription?.tier ?? null}
    hasBusinessWorkspace={Boolean(workspace.company)}
    locale={locale}
  >
    <div className={styles.page}>
      <div className={styles.pageHead}><div><span>{l("Account & billing", "Compte & facturation")}</span><h1>{l("Subscription & billing", "Abonnement & facturation")}</h1><p>{l("Manage your directory plan, free trial and payment details without mixing billing controls into your profile editor.", "Gérez votre formule d’annuaire, votre essai gratuit et vos moyens de paiement séparément de votre profil professionnel.")}</p></div></div>

      {params.checkout === "cancelled" ? <div className={`${styles.notice} ${styles.warning}`}>{l("Checkout was cancelled. No subscription changes were made.", "Le paiement a été annulé. Aucune modification n’a été apportée à votre abonnement.")}</div> : null}
      {params.plan === "basic" || params.plan === "premium" ? <div className={styles.notice}><Check size={15}/> {l("Plan change sent to Stripe. Your listing will update as soon as the subscription sync completes.", "La modification de formule a été envoyée à Stripe. Votre profil sera mis à jour dès la fin de la synchronisation.")}</div> : null}

      <div className={styles.billingGrid}>
        <section className={`${styles.card} ${styles.billingSummary}`}>
          <div className={styles.sectionHead}><div><span>{l("Current subscription", "Abonnement actuel")}</span><h2>{subscription ? `${subscription.tier === "premium" ? "Premium" : "Basic"} ${l("listing", "")}`.trim() : l("No active plan", "Aucune formule active")}</h2></div><CreditCard size={19}/></div>
          <dl>
            <div><dt>{l("Status", "Statut")}</dt><dd>{statusLabel}</dd></div>
            {subscription?.status === "trialing" && trialDays !== null ? <div><dt>{l("Free trial", "Essai gratuit")}</dt><dd>{fr ? `${trialDays} jour${trialDays === 1 ? "" : "s"} restant${trialDays === 1 ? "" : "s"}` : `${trialDays} day${trialDays === 1 ? "" : "s"} left`}</dd></div> : null}
            {subscription?.current_period_end ? <div><dt>{l("Next billing date", "Prochaine facturation")}</dt><dd>{new Date(subscription.current_period_end).toLocaleDateString(fr ? "fr-FR" : "en-GB")}</dd></div> : null}
            {subscription ? <div><dt>{l("Price", "Prix")}</dt><dd>{subscription.tier === "premium" ? `€29/${l("month", "mois")}` : `€19/${l("month", "mois")}`}</dd></div> : null}
          </dl>
          {subscription?.stripe_customer_id ? <form action={createAccountantPortalAction} style={{marginTop:16}}><button className={styles.secondary} type="submit">{l("Manage payment details", "Gérer les moyens de paiement")} <ExternalLink size={14}/></button></form> : null}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}><div><span>{l("Directory plans", "Formules annuaire")}</span><h2>{l("Choose your visibility", "Choisissez votre visibilité")}</h2></div></div>
          <div className={styles.plans}>
            <article className={`${styles.plan} ${subscription?.tier === "basic" ? styles.current : ""}`}>
              <div className={styles.planTop}><span>Basic</span><strong>€19<small>/{l("month", "mois")}</small></strong></div>
              {subscription?.tier === "basic" ? <em className={styles.currentBadge}>{l("Current plan", "Formule actuelle")}</em> : null}
              <p>{l("A complete professional listing with direct contact details and standard directory placement.", "Un profil professionnel complet avec coordonnées directes et visibilité standard dans l’annuaire.")}</p>
              <ul><li><Check size={14}/>{l("Full professional profile", "Profil professionnel complet")}</li><li><Check size={14}/>{l("Languages & specialties", "Langues & spécialités")}</li><li><Check size={14}/>{l("Direct contact details", "Coordonnées directes")}</li><li><Check size={14}/>{l("30-day free trial for new listings", "Essai gratuit de 30 jours pour les nouveaux profils")}</li></ul>
              <form action={startAccountantTrialAction}><input type="hidden" name="tier" value="basic"/><button disabled={!configured || (subscriptionOpen && subscription?.tier === "basic")} className={styles.secondary} type="submit">{basicLabel}</button></form>
            </article>

            <article className={`${styles.plan} ${styles.premium} ${subscription?.tier === "premium" ? styles.current : ""}`}>
              <div className={styles.planTop}><span><Sparkles size={13}/> Premium</span><strong>€29<small>/{l("month", "mois")}</small></strong></div>
              {subscription?.tier === "premium" ? <em className={styles.currentBadge}>{l("Current plan", "Formule actuelle")}</em> : null}
              <p>{l("Maximum visibility plus enhanced presentation and measurable lead analytics.", "Visibilité maximale, présentation renforcée et statistiques sur les prospects.")}</p>
              <ul><li><Check size={14}/>{l("Everything in Basic", "Tout ce qui est inclus dans Basic")}</li><li><Check size={14}/>{l("Featured badge", "Badge Mis en avant")}</li><li><Check size={14}/>{l("Priority placement", "Placement prioritaire")}</li><li><Check size={14}/>{l("Profile & contact analytics", "Statistiques du profil et des contacts")}</li></ul>
              <form action={startAccountantTrialAction}><input type="hidden" name="tier" value="premium"/><button disabled={!configured || (subscriptionOpen && subscription?.tier === "premium")} className={styles.primary} type="submit">{premiumLabel}</button></form>
            </article>
          </div>
          {!configured ? <p style={{fontSize:9,color:"#777",marginTop:12}}>{l("Stripe checkout is temporarily unavailable because billing configuration is incomplete.", "Le paiement Stripe est temporairement indisponible car la configuration de facturation est incomplète.")}</p> : null}
        </section>
      </div>
    </div>
  </ProfessionalFrame>;
}
