import Link from "next/link";
import { ArrowRight, Check, CreditCard, ExternalLink, Info, ShieldCheck, Sparkles, UserRound, UsersRound, WalletCards, X } from "lucide-react";
import { redirect } from "next/navigation";
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

  const purchasedPaidSeats = snapshot.billing_source === "internal" ? snapshot.billable_seats : snapshot.additional_seats;
  const usedPaidSeats = snapshot.billable_seats;
  const availablePaidSeats = Math.max(0, purchasedPaidSeats - usedPaidSeats);
  const paidSeatMonthlyCost = purchasedPaidSeats * 9.99;

  const currentPrice = snapshot.billing_source === "internal"
    ? "Premium"
    : snapshot.plan === "premium" && snapshot.billing_interval === "year"
      ? "€32.50"
      : snapshot.plan === "premium"
        ? "€39"
        : "€0";

  const currentPriceSuffix = snapshot.billing_source === "internal"
    ? l("pre-launch access", "accès pré-lancement")
    : snapshot.plan === "premium" && snapshot.billing_interval === "year"
      ? l("/ month equivalent", "/ mois équivalent")
      : l("/ month", "/ mois");

  const cycleLabel = snapshot.plan === "basic"
    ? l("Free plan", "Formule gratuite")
    : snapshot.billing_source === "internal"
      ? l("Internal pre-launch access", "Accès interne pré-lancement")
      : snapshot.billing_interval === "year"
        ? l("Annual · €390/year", "Annuel · 390 €/an")
        : l("Monthly", "Mensuel");

  const renewalLabel = snapshot.billing_source === "internal"
    ? l("Not billed during pre-launch", "Non facturé pendant le pré-lancement")
    : snapshot.cancel_at_period_end
      ? l("Access until", "Accès jusqu’au")
      : snapshot.plan === "basic"
        ? l("Allowance resets", "Réinitialisation des quotas")
        : l("Next renewal", "Prochain renouvellement");

  const basicFeatures = [
    { included: true, label: l("15 transactions / month", "15 transactions / mois") },
    { included: true, label: l("3 documents / month", "3 documents / mois") },
    { included: true, label: l("3 invoices / month", "3 factures / mois") },
    { included: true, label: l("1 bank import / month", "1 import bancaire / mois") },
    { included: false, label: l("Financial reports", "Rapports financiers") },
    { included: false, label: l("Document generation", "Génération de documents") },
    { included: false, label: l("Zuelen Copilot", "Zuelen Copilot") },
  ];

  const premiumFeatures = [
    l("Unlimited transactions", "Transactions illimitées"),
    l("Unlimited documents", "Documents illimités"),
    l("Unlimited invoices", "Factures illimitées"),
    l("Unlimited bank imports", "Imports bancaires illimités"),
    l("Reports & document generation", "Rapports et génération de documents"),
    l("Zuelen Copilot", "Zuelen Copilot"),
  ];

  return (
    <V2Page className={styles.page}>
      <PageHeader
        eyebrow={l("Plan & payments", "Formule & paiements")}
        title={l("Subscription & Billing", "Abonnement & facturation")}
        description={l("See what your plan includes, understand team-seat billing and manage payments without accounting jargon.", "Consultez ce que votre formule inclut, comprenez la facturation des sièges d’équipe et gérez vos paiements sans jargon comptable.")}
        meta={<StatusBadge tone={snapshot.plan === "premium" ? "success" : "neutral"}><span className={styles.dot} />{snapshot.plan === "premium" ? "Premium" : "Basic"}</StatusBadge>}
        actions={[{ label: l("Team & Access", "Équipe et accès"), href: "/app/settings/team", icon: UsersRound, variant: "secondary" }]}
      />

      {params.checkout === "success" ? <div className={styles.notice}>{snapshot.plan === "premium" ? l("Payment complete — Premium is active.", "Paiement effectué — Premium est actif.") : l("Payment complete. Premium access will update shortly.", "Paiement effectué. L’accès Premium sera mis à jour dans un instant.")}</div> : null}
      {params.seat === "success" ? <div className={styles.notice}>{l("Seat purchase complete. Your paid-seat capacity will update automatically.", "Achat du siège effectué. Votre capacité de sièges payants sera mise à jour automatiquement.")}</div> : null}
      {!stripeReady ? <div className={styles.notice + " " + styles.warning}>{l("Live Stripe checkout is not configured yet. Billing UI remains available for QA.", "Le paiement Stripe réel n’est pas encore configuré. L’interface de facturation reste disponible pour la QA.")}</div> : null}
      {snapshot.billing_source === "internal" ? <div className={styles.notice}>{l("This pre-launch workspace has Premium and team-seat limits enabled internally for testing, with no live charge.", "Cet espace pré-lancement bénéficie de Premium et des sièges d’équipe en interne pour les tests, sans facturation réelle.")}</div> : null}

      <section className={styles.planHero}>
        <div className={styles.planHeroMain}>
          <div className={styles.planEyebrow}><WalletCards size={15}/>{l("Your plan", "Votre formule")}</div>
          <div className={styles.planTitleRow}>
            <div>
              <h2>{snapshot.plan === "premium" ? "Premium" : "Basic"}</h2>
              <p>{snapshot.plan === "premium"
                ? l("Full Zuelen access for your business.", "Accès complet à Zuelen pour votre activité.")
                : l("A free plan for light monthly usage.", "Une formule gratuite pour une utilisation mensuelle légère.")}</p>
            </div>
            <div className={styles.planPrice}><strong>{currentPrice}</strong><span>{currentPriceSuffix}</span></div>
          </div>

          <div className={styles.planFacts}>
            <div><span>{l("Billing", "Facturation")}</span><strong>{cycleLabel}</strong></div>
            <div><span>{renewalLabel}</span><strong>{snapshot.billing_source === "internal" ? l("No live charge", "Aucune facturation réelle") : renewal}</strong></div>
            <div><span>{l("Status", "Statut")}</span><strong>{snapshot.cancel_at_period_end ? l("Cancels at period end", "Résiliation en fin de période") : l("Active", "Actif")}</strong></div>
          </div>

          {snapshot.stripe_customer_id && canManage ? <form action={createBillingPortalAction} className={styles.planActions}>
            <button className={styles.secondary} type="submit">{l("Manage payment & invoices", "Gérer paiement & factures")} <ExternalLink size={13}/></button>
          </form> : null}
        </div>

        <div className={styles.planAccess}>
          <span><ShieldCheck size={18}/></span>
          <div><strong>{snapshot.plan === "premium" ? l("Full product access", "Accès complet au produit") : l("Basic access", "Accès Basic")}</strong><p>{snapshot.plan === "premium" ? l("Transactions, documents, invoices, reports and Copilot are available without Basic monthly limits.", "Transactions, documents, factures, rapports et Copilot sont disponibles sans les limites mensuelles de Basic.") : l("Usage limits reset each month. Your existing data stays in Zuelen when you reach a limit.", "Les quotas se réinitialisent chaque mois. Vos données restent dans Zuelen lorsque vous atteignez une limite.")}</p></div>
        </div>
      </section>

      <section className={styles.seatWorkspace}>
        <div className={styles.seatHeader}>
          <div>
            <span>{l("Team access", "Accès équipe")}</span>
            <h2>{l("Seats, explained simply", "Les sièges, simplement")}</h2>
            <p>{l("A seat is one additional person who can access this Zuelen workspace. Your own owner access is never charged as a seat.", "Un siège correspond à une personne supplémentaire pouvant accéder à cet espace Zuelen. Votre propre accès de propriétaire n’est jamais facturé comme siège.")}</p>
          </div>
          <span className={styles.seatPricePill}>€9.99 <small>{l("/ paid seat / month", "/ siège payant / mois")}</small></span>
        </div>

        <div className={styles.seatLayout}>
          <div className={styles.seatVisuals}>
            <article className={styles.seatTile}>
              <span className={styles.seatIcon}><UserRound size={18}/></span>
              <div><small>{l("Workspace owner", "Propriétaire de l’espace")}</small><strong>{l("Your access", "Votre accès")}</strong><p>{l("Always included. It does not consume a paid seat.", "Toujours inclus. Il ne consomme aucun siège payant.")}</p></div>
              <em>{l("Included", "Inclus")}</em>
            </article>

            <article className={styles.seatTile}>
              <span className={styles.seatIcon}><UsersRound size={18}/></span>
              <div><small>{l("Included professional seat", "Siège professionnel inclus")}</small><strong>{l("1 Accountant or Bookkeeper", "1 Comptable ou Aide-comptable")}</strong><p>{l("One professional can collaborate with you at no extra monthly cost.", "Un professionnel peut collaborer avec vous sans coût mensuel supplémentaire.")}</p></div>
              <em>{l("€0 / month", "0 € / mois")}</em>
            </article>

            <article className={styles.seatTile + " " + styles.paidSeatTile}>
              <span className={styles.seatIcon}><CreditCard size={18}/></span>
              <div><small>{l("Paid seat capacity", "Capacité de sièges payants")}</small><strong>{purchasedPaidSeats} {l("purchased", "acheté(s)")} · {usedPaidSeats} {l("in use", "utilisé(s)")}</strong><p>{availablePaidSeats > 0 ? l(availablePaidSeats + " paid seat(s) are currently available for another team member.", availablePaidSeats + " siège(s) payant(s) sont actuellement disponibles pour un autre membre.") : purchasedPaidSeats > 0 ? l("All purchased paid seats are currently in use.", "Tous les sièges payants achetés sont actuellement utilisés.") : l("No paid seat has been purchased yet.", "Aucun siège payant n’a encore été acheté.")}</p></div>
              <em>{snapshot.billing_source === "internal" ? l("No live charge", "Sans facturation réelle") : "€" + paidSeatMonthlyCost.toFixed(2) + l(" / month", " / mois")}</em>
            </article>
          </div>

          <aside className={styles.seatGuide}>
            <div className={styles.guideTitle}><Info size={16}/><div><span>{l("How it works", "Comment ça fonctionne")}</span><strong>{l("When do you need a paid seat?", "Quand faut-il un siège payant ?")}</strong></div></div>
            <ol>
              <li><span>1</span><p>{l("You, the workspace owner, are included automatically.", "Vous, le propriétaire de l’espace, êtes inclus automatiquement.")}</p></li>
              <li><span>2</span><p>{l("Your first Accountant or Bookkeeper is also included.", "Votre premier Comptable ou Aide-comptable est également inclus.")}</p></li>
              <li><span>3</span><p>{l("Every additional Accountant/Bookkeeper needs a paid seat. Admin and Viewer team members also use paid-seat capacity.", "Chaque Comptable/Aide-comptable supplémentaire nécessite un siège payant. Les membres Admin et Lecteur utilisent également la capacité de sièges payants.")}</p></li>
              <li><span>4</span><p>{l("Purchase the seat before sending an invitation when no paid capacity is available.", "Achetez le siège avant d’envoyer une invitation lorsqu’aucune capacité payante n’est disponible.")}</p></li>
            </ol>

            <div className={styles.seatExample}>
              <strong>{l("Example", "Exemple")}</strong>
              <p>{l("You + 1 accountant = €0 extra. You + 1 accountant + 1 viewer = 1 paid seat = €9.99/month.", "Vous + 1 comptable = 0 € supplémentaire. Vous + 1 comptable + 1 lecteur = 1 siège payant = 9,99 €/mois.")}</p>
            </div>

            <div className={styles.seatActions}>
              <Link href="/app/settings/team" className={styles.secondary}>{l("Manage team", "Gérer l’équipe")} <ArrowRight size={13}/></Link>
              {canManage && snapshot.billing_source !== "internal" ? (
                snapshot.stripe_seat_subscription_id
                  ? <form action={createBillingPortalAction}><button className={styles.cta} disabled={!stripeReady} type="submit">{l("Manage paid seats", "Gérer les sièges payants")}</button></form>
                  : <form action={createSeatCheckoutAction}><button className={styles.cta} disabled={!stripeReady} type="submit">{l("Add paid seat · €9.99/mo", "Ajouter un siège · 9,99 €/mois")}</button></form>
              ) : null}
            </div>

            {!canManage ? <p className={styles.permissionNote}>{l("Only an Owner or Admin can purchase or change paid-seat capacity.", "Seul un Propriétaire ou Administrateur peut acheter ou modifier la capacité de sièges payants.")}</p> : null}
          </aside>
        </div>
      </section>

      {snapshot.plan === "basic" ? <section className={styles.planCompare}>
        <div className={styles.compareHead}><div><span>{l("Plans", "Formules")}</span><h2>{l("Choose the level that fits your workflow", "Choisissez le niveau adapté à votre activité")}</h2></div></div>
        <div className={styles.compareGrid}>
          <article className={styles.compareCard}>
            <div className={styles.compareLabel}><CreditCard size={14}/> BASIC</div>
            <div className={styles.comparePrice}>€0 <small>{l("/ month", "/ mois")}</small></div>
            <p>{l("For light monthly bookkeeping with clear limits.", "Pour une gestion mensuelle légère avec des limites claires.")}</p>
            <ul>{basicFeatures.map(feature=><li key={feature.label} className={feature.included?styles.included:styles.excluded}>{feature.included?<Check size={14}/>:<X size={14}/>}<span>{feature.label}</span></li>)}</ul>
            <span className={styles.currentPlan}>{l("Current plan", "Formule actuelle")}</span>
          </article>

          <article className={styles.compareCard + " " + styles.comparePremium}>
            <div className={styles.compareLabel}><Sparkles size={14}/> PREMIUM</div>
            <div className={styles.comparePrice}>€39 <small>{l("/ month", "/ mois")}</small></div>
            <p>{l("Unlimited day-to-day usage plus reports, document generation and Copilot.", "Utilisation quotidienne illimitée avec rapports, génération de documents et Copilot.")}</p>
            <ul>{premiumFeatures.map(feature=><li key={feature} className={styles.included}><Check size={14}/><span>{feature}</span></li>)}</ul>
            {canManage ? <div className={styles.premiumActions}>
              <form action={createPremiumCheckoutAction}><input type="hidden" name="interval" value="month"/><button className={styles.cta} disabled={!stripeReady} type="submit">{l("Choose Premium", "Choisir Premium")} <ArrowRight size={14}/></button></form>
              <form action={createPremiumCheckoutAction}><input type="hidden" name="interval" value="year"/><button className={styles.secondary} disabled={!stripeReady} type="submit">{l("Annual · €390", "Annuel · 390 €")}</button></form>
            </div> : null}
          </article>
        </div>
      </section> : <section className={styles.premiumFooter}>
        <span><Sparkles size={18}/></span>
        <div><strong>{l("Premium is active", "Premium est actif")}</strong><p>{l("Your workspace has full product access. Team seats are billed separately only when you add paid team capacity.", "Votre espace bénéficie d’un accès complet au produit. Les sièges d’équipe sont facturés séparément uniquement lorsque vous ajoutez une capacité payante.")}</p></div>
      </section>}
    </V2Page>
  );
}
