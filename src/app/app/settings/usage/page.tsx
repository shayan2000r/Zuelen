import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CalendarClock, FileText, Landmark, ReceiptText, UsersRound, WalletCards } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import { getBillingSnapshot, type UsageMetric } from "@/lib/billing";
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
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>{l("Usage", "Utilisation")}</h1>
          <p>{l("See exactly what your plan includes, what you've used, and when your allowance resets.", "Consultez précisément ce que votre formule inclut, votre consommation et la date de renouvellement de vos quotas.")}</p>
        </div>
        <span className={styles.planPill}><span className={styles.dot} />{snapshot.plan === "premium" ? "Premium" : "Basic"}</span>
      </div>

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
          <p className={styles.reset}><CalendarClock size={13} />{l("Allowance renews", "Renouvellement des quotas")} <strong>{periodEnd}</strong></p>
          {snapshot.plan === "basic" ? <div className={styles.actions}><Link className={styles.cta} href="/app/settings/billing">{l("Upgrade for unlimited", "Passer à Premium")} <ArrowUpRight size={14} /></Link></div> : null}
        </section>

        <section className={styles.card}>
          <h2>{l("Team seats", "Sièges d’équipe")}</h2>
          <p className={styles.cardLead}>{l("One owner/admin and one accountant or bookkeeper seat are included. Additional users are €9.99/month each.", "Un propriétaire/administrateur et un comptable ou aide-comptable sont inclus. Chaque utilisateur supplémentaire coûte 9,99 € / mois.")}</p>
          <div className={styles.seatNumber}><UsersRound size={20} style={{ verticalAlign: "-2px", marginRight: 8 }} />{snapshot.additional_seats} <small>{l("paid additional seats", "sièges supplémentaires payants")}</small></div>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>{l("Included professional seat", "Siège professionnel inclus")}</span><strong>1</strong></div>
            <div className={styles.summaryRow}><span>{l("Paid seats currently required", "Sièges payants actuellement requis")}</span><strong>{snapshot.billable_seats}</strong></div>
            <div className={styles.summaryRow}><span>{l("Paid seats purchased", "Sièges payants achetés")}</span><strong>{snapshot.additional_seats}</strong></div>
          </div>
          <div className={styles.actions}><Link className={styles.secondary} href="/app/settings/team">{l("Manage team", "Gérer l’équipe")}</Link><Link className={styles.secondary} href="/app/settings/billing">{l("Manage seats", "Gérer les sièges")}</Link></div>
        </section>

        <section className={styles.card}>
          <h2>{l("How limits work", "Fonctionnement des limites")}</h2>
          <p className={styles.cardLead}>{l("When a Basic allowance is reached, existing data stays available. Only the next gated action is blocked until the allowance renews or you upgrade.", "Lorsqu’un quota Basic est atteint, vos données restent accessibles. Seule la prochaine action limitée est bloquée jusqu’au renouvellement du quota ou au passage à Premium.")}</p>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>{l("Transactions", "Transactions")}</span><strong>{l("Manual + bank-imported combined", "Manuelles + imports bancaires combinés")}</strong></div>
            <div className={styles.summaryRow}><span>{l("Data access", "Accès aux données")}</span><strong>{l("Never removed by a limit", "Jamais supprimé par une limite")}</strong></div>
            <div className={styles.summaryRow}><span>{l("Reset cadence", "Cadence de renouvellement")}</span><strong>{l("Monthly anniversary", "Anniversaire mensuel")}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}
