import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CalendarClock, FileText, Infinity as InfinityIcon, Landmark, ReceiptText, UsersRound, WalletCards } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import { getBillingSnapshot, type UsageMetric } from "@/lib/billing";
import { PageHeader, StatusBadge, V2Page } from "@/components/zuelen-ui-v2";
import styles from "../commerce.module.css";

export const dynamic = "force-dynamic";

const METRICS: Array<{ key: UsageMetric; icon: typeof WalletCards; en: string; fr: string }> = [
  { key: "transactions", icon: WalletCards, en: "Transactions", fr: "Transactions" },
  { key: "documents", icon: FileText, en: "Document uploads", fr: "Documents importés" },
  { key: "invoices", icon: ReceiptText, en: "Invoices created", fr: "Factures créées" },
  { key: "bank_imports", icon: Landmark, en: "Bank statement imports", fr: "Imports de relevés bancaires" },
];

export default async function UsagePage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.organization) redirect("/setup");
  const snapshot = await getBillingSnapshot(workspace.organization.id);
  const locale = workspace.profile?.locale === "fr" ? "fr" : "en";
  const l = (en: string, fr: string) => locale === "fr" ? fr : en;
  const periodEnd = new Intl.DateTimeFormat(locale === "fr" ? "fr-LU" : "en-LU", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(snapshot.period_end));

  return (
    <V2Page className={styles.page}>
      <PageHeader eyebrow={l("Plan & capacity", "Formule & capacité")} title={l("Usage", "Utilisation")} description={l("See exactly what your plan includes, what you've used, and when your allowance resets.", "Consultez précisément ce que votre formule inclut, votre consommation et la date de renouvellement de vos quotas.")} meta={<StatusBadge tone={snapshot.plan === "premium" ? "success" : "neutral"}><span className={styles.dot} />{snapshot.plan === "premium" ? "Premium" : "Basic"}</StatusBadge>} />

      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.full}`}>
          <h2>{l("Plan usage", "Utilisation de la formule")}</h2>
          <p className={styles.cardLead}>{snapshot.plan === "premium"
            ? l("Premium removes the Basic activity limits. Your usage remains visible for transparency.", "Premium supprime les limites d’activité de Basic. Votre utilisation reste visible par souci de transparence.")
            : l("Basic allowances renew on your monthly billing anniversary.", "Les quotas Basic se renouvellent à la date anniversaire mensuelle de votre facturation.")}</p>
          <div className={styles.usageList}>
            {METRICS.map(metric => {
              const line = snapshot.usage[metric.key];
              const percent = line.limit ? Math.min(100, Math.round((line.used / line.limit) * 100)) : 100;
              const Icon = metric.icon;
              return (
                <div className={styles.usageRow} key={metric.key}>
                  <div className={styles.usageTop}>
                    <strong><Icon size={13} style={{ verticalAlign: "-2px", marginRight: 7 }} />{locale === "fr" ? metric.fr : metric.en}</strong>
                    <span>{line.limit === null ? `${line.used} · ${l("Unlimited", "Illimité")}` : `${line.used} / ${line.limit}`}</span>
                  </div>
                  <div className={styles.bar} aria-label={`${line.used}${line.limit ? ` / ${line.limit}` : ""}`}><div className={styles.fill} style={{ width: line.limit === null ? "100%" : `${percent}%`, opacity: line.limit === null ? .22 : 1 }} /></div>
                </div>
              );
            })}
          </div>
          {snapshot.plan === "basic"
            ? <p className={styles.reset}><CalendarClock size={13} />{l("Allowance renews", "Renouvellement des quotas")} <strong>{periodEnd}</strong></p>
            : <p className={styles.reset}><InfinityIcon size={13} />{l("Premium activity allowances are unlimited.", "Les quotas d’activité Premium sont illimités.")}</p>}
          {snapshot.plan === "basic" ? <div className={styles.actions}><Link className={styles.cta} href="/app/settings/billing">{l("Upgrade for unlimited", "Passer à Premium")} <ArrowUpRight size={14} /></Link></div> : null}
        </section>

        <section className={`${styles.card} ${styles.full}`}>
          <h2>{l("Team seats", "Sièges d’équipe")}</h2>
          <p className={styles.cardLead}>{l("One owner/admin and one accountant or bookkeeper seat are included. Additional users are €9.99/month each.", "Un propriétaire/administrateur et un comptable ou aide-comptable sont inclus. Chaque utilisateur supplémentaire coûte 9,99 € / mois.")}</p>
          <div className={styles.seatNumber}><UsersRound size={20} style={{ verticalAlign: "-2px", marginRight: 8 }} />{snapshot.billing_source === "internal" ? snapshot.billable_seats : snapshot.additional_seats} <small>{snapshot.billing_source === "internal" ? l("pre-launch additional seats", "sièges supplémentaires pré-lancement") : l("paid additional seats", "sièges supplémentaires payants")}</small></div>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>{l("Included professional seat", "Siège professionnel inclus")}</span><strong>1</strong></div>
            <div className={styles.summaryRow}><span>{l("Additional seats currently required", "Sièges supplémentaires actuellement requis")}</span><strong>{snapshot.billable_seats}</strong></div>
            <div className={styles.summaryRow}><span>{snapshot.billing_source === "internal" ? l("Pre-launch access", "Accès pré-lancement") : l("Paid seats purchased", "Sièges payants achetés")}</span><strong>{snapshot.billing_source === "internal" ? l("Included", "Inclus") : snapshot.additional_seats}</strong></div>
          </div>
          <div className={styles.actions}><Link className={styles.secondary} href="/app/settings/team">{l("Manage team", "Gérer l’équipe")}</Link><Link className={styles.secondary} href="/app/settings/billing">{l("Manage seats", "Gérer les sièges")}</Link></div>
        </section>

      </div>
    </V2Page>
  );
}
