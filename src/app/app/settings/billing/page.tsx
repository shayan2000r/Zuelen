import { redirect } from "next/navigation";
import { ArrowRight, Check, CreditCard, ExternalLink, ShieldCheck, Sparkles, UsersRound, X } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import { getBillingSnapshot } from "@/lib/billing";
import { canManageOrganization } from "@/lib/permissions";
import { stripeConfigured } from "@/lib/stripe";
import { createBillingPortalAction, createPremiumCheckoutAction, createSeatCheckoutAction } from "./actions";
import { PageHeader, StatusBadge, V2Page } from "@/components/zuelen-ui-v2";
import styles from "../commerce.module.css";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; seat?: string }> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.organization) redirect("/setup");
  const snapshot = await getBillingSnapshot(workspace.organization.id);
  const params = await searchParams;
  const locale = workspace.profile?.locale === "fr" ? "fr" : "en";
  const l = (en: string, fr: string) => locale === "fr" ? fr : en;
  const canManage = canManageOrganization(workspace.role);
  const stripeReady = stripeConfigured();
  const renewal = new Intl.DateTimeFormat(locale === "fr" ? "fr-LU" : "en-LU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(snapshot.period_end));
  const extraSeatCost = snapshot.additional_seats * 9.99;
  const currentPrice = snapshot.billing_source === "internal" ? "Premium" : snapshot.plan === "premium" && snapshot.billing_interval === "year" ? "€32.50" : snapshot.plan === "premium" ? "€39" : "€0";
  const currentPriceSuffix = snapshot.billing_source === "internal" ? l("pre-launch access", "accès pré-lancement") : snapshot.plan === "premium" && snapshot.billing_interval === "year" ? l("/ month equivalent · €390/year", "/ mois équivalent · 390 €/an") : l("/ month", "/ mois");
  const statusLabel = snapshot.status ? snapshot.status.charAt(0).toUpperCase() + snapshot.status.slice(1).replaceAll("_", " ") : "—";

  const basicFeatures = [
    { included: true, label: l("15 transactions / month", "15 transactions / mois") },
    { included: true, label: l("3 documents / month", "3 documents / mois") },
    { included: true, label: l("3 invoices / month", "3 factures / mois") },
    { included: true, label: l("1 bank statement import / month", "1 import de relevé bancaire / mois") },
    { included: false, label: l("Reports not included", "Rapports non inclus") },
    { included: false, label: l("Document generation not included", "Génération de documents non incluse") },
    { included: false, label: l("Zuelen Copilot not included", "Zuelen Copilot non inclus") },
  ];
  const premiumFeatures = [
    l("Unlimited transactions", "Transactions illimitées"),
    l("Unlimited documents", "Documents illimités"),
    l("Unlimited invoices", "Factures illimitées"),
    l("Unlimited bank statement imports", "Imports de relevés bancaires illimités"),
    l("Reports included", "Rapports inclus"),
    l("Document generation included", "Génération de documents incluse"),
    l("Zuelen Copilot included", "Zuelen Copilot inclus"),
  ];

  return (
    <V2Page className={styles.page}>
      <PageHeader eyebrow={l("Plan & Payments", "Formule & paiements")} title={l("Subscription & Billing", "Abonnement & facturation")} description={l("Manage your Zuelen plan, seats, payment details and invoices in one place.", "Gérez votre formule Zuelen, vos sièges, vos moyens de paiement et vos factures au même endroit.")} meta={<StatusBadge tone={snapshot.plan === "premium" ? "success" : "neutral"}><span className={styles.dot} />{snapshot.plan === "premium" ? "Premium" : "Basic"}</StatusBadge>} />

      {params.checkout === "success" ? <div className={styles.notice}>{snapshot.plan === "premium" ? l("Thank you. Your payment is complete and your Premium subscription is active.", "Merci. Votre paiement a été effectué et votre abonnement Premium est actif.") : l("Thank you. Your payment is complete. Your Premium access will be ready in a moment.", "Merci. Votre paiement a été effectué. Votre accès Premium sera disponible dans un instant.")}</div> : null}
      {params.seat === "success" ? <div className={styles.notice}>{l("Seat checkout completed. Your paid seat count will update automatically.", "Paiement du siège effectué. Le nombre de sièges payants se mettra à jour automatiquement.")}</div> : null}
      {!stripeReady ? <div className={`${styles.notice} ${styles.warning}`}>{l("The subscription architecture is active, but Stripe credentials and Price IDs still need to be added to Vercel before live checkout can be used.", "L’architecture d’abonnement est active, mais les identifiants Stripe et les Price IDs doivent encore être ajoutés dans Vercel avant l’activation des paiements réels.")}</div> : null}
      {snapshot.billing_source === "internal" ? <div className={styles.notice}>{l("This pre-launch workspace has Premium enabled internally so development and QA are not restricted by Basic limits.", "Cet espace de travail pré-lancement bénéficie de Premium en interne afin que le développement et la QA ne soient pas limités par les quotas Basic.")}</div> : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>{l("Current Plan", "Formule actuelle")}</h2>
          <p className={styles.cardLead}>{snapshot.plan === "premium" ? l("Run the company with Zuelen's complete accounting and compliance workflow.", "Gérez l’entreprise avec l’ensemble des flux comptables et de conformité de Zuelen.") : l("Basic gives you a genuine €0 plan with transparent monthly allowances.", "Basic est une véritable formule à 0 € avec des quotas mensuels transparents.")}</p>
          <div className={styles.seatNumber}>{currentPrice} <small>{currentPriceSuffix}</small></div>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>{l("Status", "Statut")}</span><strong>{statusLabel}</strong></div>
            <div className={styles.summaryRow}><span>{l("Billing Interval", "Périodicité")}</span><strong>{snapshot.plan === "basic" ? "—" : snapshot.billing_interval === "year" ? l("Annual", "Annuel") : snapshot.billing_interval === "month" ? l("Monthly", "Mensuel") : l("Internal", "Interne")}</strong></div>
            <div className={styles.summaryRow}><span>{snapshot.billing_source === "internal" ? l("Billing", "Facturation") : snapshot.cancel_at_period_end ? l("Access Until", "Accès jusqu’au") : snapshot.plan === "basic" ? l("Allowance Reset", "Renouvellement du quota") : l("Next Renewal", "Prochain renouvellement")}</span><strong>{snapshot.billing_source === "internal" ? l("Not billed during pre-launch", "Non facturé pendant le pré-lancement") : renewal}</strong></div>
          </div>
          {snapshot.stripe_customer_id && canManage ? <form action={createBillingPortalAction} className={styles.actions}><button className={styles.secondary} type="submit">{l("Manage payment & invoices", "Gérer paiement & factures")} <ExternalLink size={13} /></button></form> : null}
        </section>

        <section className={styles.card}>
          <h2>{l("Team Seats", "Sièges d’équipe")}</h2>
          <p className={styles.cardLead}>{l("One accountant/bookkeeper seat is included on both plans. Every additional user is €9.99/month.", "Un siège comptable/aide-comptable est inclus dans les deux formules. Chaque utilisateur supplémentaire coûte 9,99 € / mois.")}</p>
          <div className={styles.seatNumber}><UsersRound size={20} style={{ verticalAlign: "-2px", marginRight: 8 }} />{snapshot.billing_source === "internal" ? snapshot.billable_seats : snapshot.additional_seats} <small>{snapshot.billing_source === "internal" ? l("pre-launch additional seats", "sièges supplémentaires pré-lancement") : l("additional paid seats", "sièges payants supplémentaires")}</small></div>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>{l("Included Professional Seat", "Siège professionnel inclus")}</span><strong>€0</strong></div>
            <div className={styles.summaryRow}><span>{snapshot.billing_source === "internal" ? l("Pre-launch Additional Seats", "Sièges supplémentaires pré-lancement") : l("Additional Seats", "Sièges supplémentaires")}</span><strong>{snapshot.billing_source === "internal" ? l("Included", "Inclus") : `€${extraSeatCost.toFixed(2)}/mo`}</strong></div>
          </div>
          {canManage && snapshot.billing_source !== "internal" ? <div className={styles.actions}>
            {snapshot.stripe_seat_subscription_id
              ? <form action={createBillingPortalAction}><button className={`${styles.secondary} ${!stripeReady ? styles.disabled : ""}`} disabled={!stripeReady} type="submit">{l("Manage seat quantity", "Gérer le nombre de sièges")}</button></form>
              : <form action={createSeatCheckoutAction}><button className={`${styles.secondary} ${!stripeReady ? styles.disabled : ""}`} disabled={!stripeReady} type="submit">{l("Add a €9.99 seat", "Ajouter un siège à 9,99 €")}</button></form>}
          </div> : !canManage ? <p className={styles.muted}>{l("Only an owner or admin can change billing.", "Seul un propriétaire ou administrateur peut modifier la facturation.")}</p> : null}
        </section>

        {snapshot.plan === "basic" ? <section className="billing-plan-showcase">
          <div className="billing-plan-showcase-head">
            <div><span>{l("Plans", "Formules")}</span><h2>{l("Choose the plan that fits your workflow.", "Choisissez la formule adaptée à votre activité.")}</h2></div>
            <div className="billing-cycle-note" aria-label={l("Monthly and annual Premium billing options", "Options de facturation Premium mensuelle et annuelle")}><span>{l("Monthly", "Mensuel")}</span><span>{l("Annual", "Annuel")}</span><b>{l("2 months free", "2 mois offerts")}</b></div>
          </div>
          <div className="billing-plan-grid">
            <article className="billing-plan-card billing-plan-basic">
              <div className="billing-plan-label"><CreditCard size={14}/> BASIC</div>
              <div className="billing-plan-price">€0 <small>/ {l("month", "mois")}</small></div>
              <div className="billing-plan-strip"><strong>{l("Free, every month", "Gratuit, chaque mois")}</strong><span>{l("No annual commitment · No card required", "Sans engagement annuel · Aucune carte requise")}</span></div>
              <p className="billing-plan-copy">{l("A practical starting point for keeping everyday finances together in one clear system.", "Un point de départ pratique pour réunir les finances quotidiennes dans un système clair.")}</p>
              <ul className="billing-feature-list">{basicFeatures.map(feature=><li key={feature.label} className={feature.included?"included":"excluded"}>{feature.included?<Check size={14}/>:<X size={14}/>}<span>{feature.label}</span></li>)}</ul>
              <div className="billing-current-plan">{l("Current Plan", "Formule actuelle")}</div>
            </article>

            <article className="billing-plan-card billing-plan-premium">
              <div className="billing-plan-top"><div className="billing-plan-label"><Sparkles size={14}/> PREMIUM</div><span className="billing-most-chosen">{l("MOST CHOSEN", "LE PLUS CHOISI")}</span></div>
              <div className="billing-plan-price">€39 <small>/ {l("month", "mois")}</small></div>
              <div className="billing-plan-strip"><strong>{l("Or €390 billed annually", "Ou 390 € facturés annuellement")}</strong><span>{l("€78 saved with the annual plan", "78 € économisés avec la formule annuelle")}</span></div>
              <p className="billing-plan-copy">{l("The complete Zuelen workspace for managing your finances without Basic's monthly limits.", "L’espace Zuelen complet pour gérer vos finances sans les limites mensuelles de la formule Basic.")}</p>
              <ul className="billing-feature-list">{premiumFeatures.map(feature=><li key={feature} className="included"><Check size={14}/><span>{feature}</span></li>)}</ul>
              {canManage ? <div className="billing-premium-actions">
                <form action={createPremiumCheckoutAction}><input type="hidden" name="interval" value="month"/><button className="billing-premium-cta" disabled={!stripeReady} type="submit">{l("Choose Premium", "Choisir Premium")} <ArrowRight size={14}/></button></form>
                <form action={createPremiumCheckoutAction}><input type="hidden" name="interval" value="year"/><button className="billing-premium-annual" disabled={!stripeReady} type="submit">{l("Annual · €390", "Annuel · 390 €")}</button></form>
              </div> : <div className="billing-current-plan">{l("Only an owner or admin can upgrade", "Seul un propriétaire ou administrateur peut changer de formule")}</div>}
            </article>
          </div>
        </section> : <section className={`${styles.card} ${styles.full}`}>
          <h2>{l("Premium Is Active", "Premium est actif")}</h2>
          <p className={styles.cardLead}>{l("Your company has full access to Zuelen. Existing data remains yours if you ever cancel; only Premium actions become unavailable after the paid period ends.", "Votre entreprise bénéficie de l’accès complet à Zuelen. Vos données restent accessibles en cas de résiliation ; seules les actions Premium deviennent indisponibles à la fin de la période payée.")}</p>
          <div className={styles.actions}><span className={styles.planPill}><ShieldCheck size={13} />{l("Full product access", "Accès complet au produit")}</span><span className={styles.planPill}><CreditCard size={13} />{snapshot.billing_source === "stripe" ? "Stripe" : l("Internal preview", "Prévisualisation interne")}</span></div>
        </section>}
      </div>
    </V2Page>
  );
}
