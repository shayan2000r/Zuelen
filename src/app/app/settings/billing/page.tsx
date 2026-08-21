import { redirect } from "next/navigation";
import { ArrowRight, Check, CreditCard, ExternalLink, ShieldCheck, UsersRound } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import { getBillingSnapshot } from "@/lib/billing";
import { canManageOrganization } from "@/lib/permissions";
import { stripeConfigured } from "@/lib/stripe";
import { createBillingPortalAction, createPremiumCheckoutAction, createSeatCheckoutAction } from "./actions";
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>{l("Subscription & billing", "Abonnement & facturation")}</h1>
          <p>{l("Manage your Zuelen plan, seats, payment details and invoices in one place.", "Gérez votre formule Zuelen, vos sièges, vos moyens de paiement et vos factures au même endroit.")}</p>
        </div>
        <span className={styles.planPill}><span className={styles.dot} />{snapshot.plan === "premium" ? "Premium" : "Basic"}</span>
      </div>

      {params.checkout === "success" ? <div className={styles.notice}>{l("Payment completed. Stripe is confirming your Premium subscription; the plan updates automatically as soon as the webhook is received.", "Paiement effectué. Stripe confirme votre abonnement Premium ; la formule se met à jour automatiquement dès réception de la notification.")}</div> : null}
      {params.seat === "success" ? <div className={styles.notice}>{l("Seat checkout completed. Your paid seat count will update automatically.", "Paiement du siège effectué. Le nombre de sièges payants se mettra à jour automatiquement.")}</div> : null}
      {!stripeReady ? <div className={`${styles.notice} ${styles.warning}`}>{l("The subscription architecture is active, but Stripe credentials and Price IDs still need to be added to Vercel before live checkout can be used.", "L’architecture d’abonnement est active, mais les identifiants Stripe et les Price IDs doivent encore être ajoutés dans Vercel avant l’activation des paiements réels.")}</div> : null}
      {snapshot.billing_source === "internal" ? <div className={styles.notice}>{l("This pre-launch workspace has Premium enabled internally so development and QA are not restricted by Basic limits.", "Cet espace de travail pré-lancement bénéficie de Premium en interne afin que le développement et la QA ne soient pas limités par les quotas Basic.")}</div> : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>{l("Current plan", "Formule actuelle")}</h2>
          <p className={styles.cardLead}>{snapshot.plan === "premium" ? l("Run the company with Zuelen's complete accounting and compliance workflow.", "Gérez l’entreprise avec l’ensemble des flux comptables et de conformité de Zuelen.") : l("Basic gives you a genuine €0 plan with transparent monthly allowances.", "Basic est une véritable formule à 0 € avec des quotas mensuels transparents.")}</p>
          <div className={styles.seatNumber}>{currentPrice} <small>{currentPriceSuffix}</small></div>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>{l("Status", "Statut")}</span><strong>{snapshot.status}</strong></div>
            <div className={styles.summaryRow}><span>{l("Billing interval", "Périodicité")}</span><strong>{snapshot.plan === "basic" ? "—" : snapshot.billing_interval === "year" ? l("Annual", "Annuel") : snapshot.billing_interval === "month" ? l("Monthly", "Mensuel") : l("Internal", "Interne")}</strong></div>
            <div className={styles.summaryRow}><span>{snapshot.billing_source === "internal" ? l("Billing", "Facturation") : snapshot.cancel_at_period_end ? l("Access until", "Accès jusqu’au") : snapshot.plan === "basic" ? l("Allowance reset", "Renouvellement du quota") : l("Next renewal", "Prochain renouvellement")}</span><strong>{snapshot.billing_source === "internal" ? l("Not billed during pre-launch", "Non facturé pendant le pré-lancement") : renewal}</strong></div>
          </div>
          {snapshot.stripe_customer_id && canManage ? <form action={createBillingPortalAction} className={styles.actions}><button className={styles.secondary} type="submit">{l("Manage payment & invoices", "Gérer paiement & factures")} <ExternalLink size={13} /></button></form> : null}
        </section>

        <section className={styles.card}>
          <h2>{l("Team seats", "Sièges d’équipe")}</h2>
          <p className={styles.cardLead}>{l("One accountant/bookkeeper seat is included on both plans. Every additional user is €9.99/month.", "Un siège comptable/aide-comptable est inclus dans les deux formules. Chaque utilisateur supplémentaire coûte 9,99 € / mois.")}</p>
          <div className={styles.seatNumber}><UsersRound size={20} style={{ verticalAlign: "-2px", marginRight: 8 }} />{snapshot.billing_source === "internal" ? snapshot.billable_seats : snapshot.additional_seats} <small>{snapshot.billing_source === "internal" ? l("pre-launch additional seats", "sièges supplémentaires pré-lancement") : l("additional paid seats", "sièges payants supplémentaires")}</small></div>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>{l("Included professional seat", "Siège professionnel inclus")}</span><strong>€0</strong></div>
            <div className={styles.summaryRow}><span>{snapshot.billing_source === "internal" ? l("Pre-launch additional seats", "Sièges supplémentaires pré-lancement") : l("Additional seats", "Sièges supplémentaires")}</span><strong>{snapshot.billing_source === "internal" ? l("Included", "Inclus") : `€${extraSeatCost.toFixed(2)}/mo`}</strong></div>
          </div>
          {canManage && snapshot.billing_source !== "internal" ? <div className={styles.actions}>
            {snapshot.stripe_seat_subscription_id
              ? <form action={createBillingPortalAction}><button className={`${styles.secondary} ${!stripeReady ? styles.disabled : ""}`} disabled={!stripeReady} type="submit">{l("Manage seat quantity", "Gérer le nombre de sièges")}</button></form>
              : <form action={createSeatCheckoutAction}><button className={`${styles.secondary} ${!stripeReady ? styles.disabled : ""}`} disabled={!stripeReady} type="submit">{l("Add a €9.99 seat", "Ajouter un siège à 9,99 €")}</button></form>}
          </div> : !canManage ? <p className={styles.muted}>{l("Only an owner or admin can change billing.", "Seul un propriétaire ou administrateur peut modifier la facturation.")}</p> : null}
        </section>

        {snapshot.plan === "basic" ? <section className={`${styles.card} ${styles.full}`}>
          <h2>{l("Upgrade to Premium", "Passer à Premium")}</h2>
          <p className={styles.cardLead}>{l("Unlock the complete Zuelen workflow and remove Basic activity limits.", "Débloquez l’ensemble des fonctionnalités Zuelen et supprimez les limites d’activité de Basic.")}</p>
          <ul className={styles.features}>
            {[l("Unlimited transactions, invoices, document uploads and bank imports", "Transactions, factures, documents et imports bancaires illimités"), l("Full VAT and tax workflows", "Flux TVA et fiscaux complets"), l("Reports, annual accounts and eCDF", "Rapports, comptes annuels et eCDF"), l("Zuelen Copilot", "Zuelen Copilot"), l("Filing-ready documents and full compliance tracking", "Documents prêts au dépôt et suivi complet de conformité")].map(feature => <li key={feature}><Check size={14} />{feature}</li>)}
          </ul>
          <div className={styles.pricing}>
            <div className={styles.priceOption}>
              <strong>{l("Monthly", "Mensuel")}</strong>
              <div className={styles.price}>€39 <small>/ {l("month", "mois")}</small></div>
              {canManage ? <form action={createPremiumCheckoutAction}><input type="hidden" name="interval" value="month" /><button className={`${styles.cta} ${!stripeReady ? styles.disabled : ""}`} disabled={!stripeReady} type="submit">{l("Choose monthly", "Choisir mensuel")} <ArrowRight size={14} /></button></form> : null}
            </div>
            <div className={styles.priceOption}>
              <strong>{l("Annual", "Annuel")}</strong>
              <span className={styles.save}>{l("2 months free", "2 mois offerts")}</span>
              <div className={styles.price}>€390 <small>/ {l("year", "an")}</small></div>
              <p className={styles.muted}>€32.50 / {l("month equivalent", "mois équivalent")}</p>
              {canManage ? <form action={createPremiumCheckoutAction}><input type="hidden" name="interval" value="year" /><button className={`${styles.cta} ${!stripeReady ? styles.disabled : ""}`} disabled={!stripeReady} type="submit">{l("Choose annual", "Choisir annuel")} <ArrowRight size={14} /></button></form> : null}
            </div>
          </div>
        </section> : <section className={`${styles.card} ${styles.full}`}>
          <h2>{l("Premium is active", "Premium est actif")}</h2>
          <p className={styles.cardLead}>{l("Your company has full access to Zuelen. Existing data remains yours if you ever cancel; only Premium actions become unavailable after the paid period ends.", "Votre entreprise bénéficie de l’accès complet à Zuelen. Vos données restent accessibles en cas de résiliation ; seules les actions Premium deviennent indisponibles à la fin de la période payée.")}</p>
          <div className={styles.actions}><span className={styles.planPill}><ShieldCheck size={13} />{l("Full product access", "Accès complet au produit")}</span><span className={styles.planPill}><CreditCard size={13} />{snapshot.billing_source === "stripe" ? "Stripe" : l("Internal preview", "Prévisualisation interne")}</span></div>
        </section>}
      </div>
    </div>
  );
}
