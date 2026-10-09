import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileOutput,
  Landmark,
  ReceiptText,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VatFilingAction } from "@/components/vat-filing-action";
import { DataSummary } from "@/components/zuelen-data-ui-v2";
import { PageHeader, StatusBadge, V2Page } from "@/components/zuelen-ui-v2";
import styles from "@/components/vat-filing.module.css";
import { intlLocale, normalizeLocale, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { vatRatesOn } from "@/lib/tax-rules/vat";
import { VAT_FORM_SOURCES, vatFormLayout } from "@/lib/vat-return/forms";
import { loadVatReturn } from "@/lib/vat-return/load";
import { currentVatPeriod, parseVatPeriod, vatPeriodsOfYear, type VatFrequency } from "@/lib/vat-return/periods";
import type { VatIssueCode } from "@/lib/vat-return/compute";
export const dynamic = "force-dynamic";
function money(v: number, c: string, l: Locale) {
  return new Intl.NumberFormat(intlLocale(l), { style: "currency", currency: c, minimumFractionDigits: 2 }).format(v);
}
function amount(v: number | undefined, l: Locale) {
  return v
    ? new Intl.NumberFormat(intlLocale(l), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
    : "—";
}
const ISSUE_TEXT: Record<VatIssueCode, { fr: string; en: string }> = {
  zero_rate_sale: {
    fr: "Vente luxembourgeoise sans TVA : précisez l'exonération (ou le taux) dans l'opération.",
    en: "Luxembourg sale without VAT: state the exemption (or the rate) on the transaction.",
  },
  sale_abroad_unclear: {
    fr: "Vente à l'étranger : indiquez s'il s'agit d'une entreprise (autoliquidation) et du pays du client.",
    en: "Sale abroad: say whether the customer is a business (reverse charge) and its country.",
  },
  country_missing: {
    fr: "Pays du client ou du fournisseur manquant : il détermine la case de la déclaration.",
    en: "Customer or supplier country missing: it decides the box of the return.",
  },
  rate_not_on_form: {
    fr: "Taux de TVA absent du formulaire officiel pour cette opération.",
    en: "VAT rate not on the official form for this transaction.",
  },
  unknown_treatment: {
    fr: "Situation TVA non confirmée.",
    en: "VAT situation not confirmed.",
  },
  revenue_branch_unclear: {
    fr: "Compte de produits hors 702–708 : vérifiez la case du chiffre d'affaires (compté en 004).",
    en: "Revenue account outside 702–708: check the turnover box (counted in 004).",
  },
};
type Params = { period?: string };
export default async function VatFilingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const w = await getWorkspace();
  if (!w.authenticated) redirect("/sign-in");
  if (!w.company) redirect("/setup");
  if (!w.capabilities?.hasVat) redirect("/app/taxes?not_applicable=vat");
  const params = await searchParams;
  const locale = normalizeLocale(w.profile?.locale),
    fr = locale === "fr",
    dateLocale = intlLocale(locale),
    s = await createClient(),
    currency = w.company.base_currency || "EUR",
    frequency = (
      ["monthly", "quarterly", "annual"].includes(w.company.vat_filing_frequency ?? "")
        ? w.company.vat_filing_frequency
        : "annual"
    ) as VatFrequency,
    today = new Date().toISOString().slice(0, 10),
    period = (params.period && parseVatPeriod(params.period)) || currentVatPeriod(today, frequency),
    year = Number(period.start.slice(0, 4)),
    from = period.start,
    to = period.end;
  const [vatReturn, { count: pendingCount }, { data: taxMeta }, { data: filings }] = await Promise.all([
    loadVatReturn(s, w.company, period),
    s
      .from("source_transactions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", w.company.id)
      .in("classification_status", ["unclassified", "review", "classified"])
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    s
      .from("source_transactions")
      .select("id,source_type,vat_treatment")
      .eq("company_id", w.company.id)
      .eq("classification_status", "posted")
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    s
      .from("filings")
      .select("id,status,period_label,snapshot_at,export_status,payload,period_start,period_end")
      .eq("company_id", w.company.id)
      .eq("filing_type", "vat_return")
      .eq("period_start", from)
      .eq("period_end", to)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const boxes = vatReturn.boxes,
    output = boxes["076"] ?? 0,
    input = boxes["102"] ?? 0,
    net = boxes["105"] ?? 0,
    bankEvidenceMissing = (taxMeta ?? []).filter(t => t.source_type === "bank" && t.vat_treatment === "unknown").length,
    unknownNonBank = (taxMeta ?? []).filter(t => t.source_type !== "bank" && t.vat_treatment === "unknown").length,
    recapBase = (boxes["457"] ?? 0) + (boxes["013"] ?? 0) + (boxes["423"] ?? 0),
    ready =
      (pendingCount ?? 0) === 0 &&
      bankEvidenceMissing === 0 &&
      unknownNonBank === 0 &&
      vatReturn.issues.length === 0 &&
      vatReturn.reconciled,
    source = VAT_FORM_SOURCES[period.form],
    formName =
      period.form === "DECA"
        ? fr
          ? "Déclaration annuelle"
          : "Annual return"
        : period.form === "DECT"
          ? fr
            ? "Déclaration trimestrielle"
            : "Quarterly return"
          : fr
            ? "Déclaration mensuelle"
            : "Monthly return",
    periodLabel = (key: string) => {
      const p = parseVatPeriod(key)!;
      if (p.form === "DECA") return fr ? `Année ${key}` : `Year ${key}`;
      if (p.form === "DECT") return key.replace("-", " ");
      return new Date(`${p.start}T00:00:00Z`).toLocaleDateString(dateLocale, {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    },
    periods = [...vatPeriodsOfYear(year - 1, frequency), ...vatPeriodsOfYear(year, frequency)];
  const freqLabel = fr
      ? frequency === "annual"
        ? "annuelle"
        : frequency === "quarterly"
          ? "trimestrielle"
          : "mensuelle"
      : frequency,
    due =
      period.form === "DECA"
        ? frequency === "annual"
          ? fr
            ? `Avant le 1er mars ${year + 1}`
            : `Before 1 Mar ${year + 1}`
          : fr
            ? `Avant le 1er mai ${year + 1}`
            : `Before 1 May ${year + 1}`
        : fr
          ? "Avant le 15 du mois qui suit la période"
          : "Before the 15th of the month after the period";
  return (
    <V2Page className={styles.page}>
      <PageHeader
        eyebrow={(fr ? "Déclaration TVA · " : "VAT return · ") + periodLabel(period.key)}
        title={fr ? "TVA" : "VAT"}
        description={
          fr
            ? "Votre déclaration TVA case par case, calculée à partir des factures émises et des opérations comptabilisées."
            : "Your VAT return box by box, computed from issued invoices and posted transactions."
        }
        meta={
          <StatusBadge tone={ready ? "success" : "warning"}>
            <BadgeCheck size={13} />
            {fr ? "TVA LU · " + freqLabel : "LU VAT · " + freqLabel}
          </StatusBadge>
        }
      />

      <nav className={styles.periods} aria-label={fr ? "Période de déclaration" : "Return period"}>
        {periods.map(p => (
          <Link
            key={p.key}
            href={`/app/vat?period=${p.key}`}
            className={p.key === period.key ? styles.periodActive : undefined}
            aria-current={p.key === period.key ? "page" : undefined}
          >
            {periodLabel(p.key)}
          </Link>
        ))}
      </nav>

      <section className={styles.contextGuide}>
        <div className={styles.contextLead}>
          <span>
            <CircleHelp size={18} />
          </span>
          <div>
            <p>{fr ? "Comprendre cette page" : "What this page is telling you"}</p>
            <h2>
              {ready
                ? fr
                  ? "Votre TVA est prête à être vérifiée"
                  : "Your VAT is ready for review"
                : fr
                  ? "Il reste des éléments à confirmer avant la déclaration"
                  : "Some items still need attention before filing"}
            </h2>
            <small>
              {fr
                ? "Zuelen calcule votre position TVA à partir des écritures comptabilisées et des justificatifs disponibles. Une transaction bancaire seule ne prouve pas une TVA déductible."
                : "Zuelen builds your VAT position from posted bookkeeping and available evidence. A bank transaction on its own does not prove deductible VAT."}
            </small>
          </div>
        </div>
        <div className={styles.contextSteps}>
          <div>
            <strong>{fr ? "TVA collectée" : "Output VAT"}</strong>
            <span>
              {fr
                ? "TVA facturée à vos clients sur les ventes taxables."
                : "VAT charged to customers on taxable sales."}
            </span>
          </div>
          <div>
            <strong>{fr ? "TVA déductible" : "Recoverable input VAT"}</strong>
            <span>
              {fr
                ? "TVA sur les achats professionnels lorsqu’elle est correctement justifiée et déductible."
                : "VAT on business purchases when it is properly evidenced and deductible."}
            </span>
          </div>
          <div>
            <strong>{fr ? "À vérifier maintenant" : "What to check now"}</strong>
            <span>
              {ready
                ? fr
                  ? "Aucun élément bloquant détecté ; vérifiez les montants avant de préparer la déclaration."
                  : "No blocking items detected; review the figures before preparing the filing."
                : fr
                  ? `${pendingCount ?? 0} transaction(s) à vérifier · ${bankEvidenceMissing + unknownNonBank + vatReturn.issues.length} élément(s) TVA à préciser.`
                  : `${pendingCount ?? 0} transaction(s) need review · ${bankEvidenceMissing + unknownNonBank + vatReturn.issues.length} VAT item(s) to clarify.`}
            </span>
          </div>
        </div>
        <div className={styles.contextFoot}>
          <span>
            {fr
              ? `Taux luxembourgeois en vigueur au ${to} : ${vatRatesOn(to)
                  .filter(r => r > 0)
                  .join(
                    " %, ",
                  )} %. Ne choisissez pas un taux au hasard : utilisez le justificatif ou confirmez le traitement applicable.`
              : `Luxembourg VAT rates in force on ${to}: ${vatRatesOn(to)
                  .filter(r => r > 0)
                  .join(
                    "%, ",
                  )}%. Do not guess a rate: use the supporting document or confirm the applicable treatment.`}
          </span>
          <a
            href="https://guichet.public.lu/en/entreprises/fiscalite/impots-benefices/tva/notions/tva.html"
            target="_blank"
            rel="noreferrer"
          >
            {fr ? "Guide TVA officiel" : "Official VAT guide"} <ExternalLink size={11} />
          </a>
        </div>
      </section>

      <DataSummary
        label={fr ? "Résumé TVA" : "VAT summary"}
        items={[
          {
            label: fr ? "Position nette TVA" : "Net VAT position",
            value: money(Math.abs(net), currency, locale),
            description:
              net > 0
                ? fr
                  ? "À payer à l’AED"
                  : "Payable to AED"
                : net < 0
                  ? fr
                    ? "Crédit TVA récupérable"
                    : "Recoverable VAT credit"
                  : fr
                    ? "Position équilibrée"
                    : "Balanced position",
            icon: Scale,
            tone: net > 0 ? "warning" : net < 0 ? "info" : "success",
          },
          {
            label: fr ? "TVA collectée" : "Output VAT",
            value: money(output, currency, locale),
            description: fr ? "Case 076 · taxe en aval" : "Box 076 · output tax",
            icon: ReceiptText,
            tone: "info",
          },
          {
            label: fr ? "TVA déductible" : "Recoverable input VAT",
            value: money(input, currency, locale),
            description: fr ? "Case 102 · taxe en amont déductible" : "Box 102 · deductible input tax",
            icon: CheckCircle2,
            tone: "success",
          },
          {
            label: fr ? "Échéance de déclaration" : "Filing deadline",
            value: due,
            description: formName,
            icon: Landmark,
            tone: "warning",
          },
        ]}
      />

      <section className={styles.card}>
        <div className={styles.head}>
          <div>
            <p>
              {formName} · eCDF TVA_{period.form} · {source.version}
            </p>
            <h2>{fr ? "Déclaration case par case" : "Return box by box"}</h2>
          </div>
          <ReceiptText />
        </div>
        <p className={styles.formNote}>
          {fr
            ? "Montants en euros, à reporter dans le formulaire officiel sur eCDF / MyGuichet. Les cases vides ne sont pas concernées par les opérations enregistrées dans Zuelen (importations, opérations triangulaires, etc.) : complétez-les si elles s'appliquent."
            : "Amounts in euros, to enter in the official form on eCDF / MyGuichet. Empty boxes are not covered by the transactions recorded in Zuelen (imports, triangular transactions, etc.): complete them if they apply."}{" "}
          <a href={fr ? source.url : source.urlEn} target="_blank" rel="noreferrer">
            {fr ? "Formulaire officiel" : "Official form"} <ExternalLink size={11} />
          </a>
        </p>
        {vatFormLayout(period.form).map(section => (
          <div key={section.title.en} className={styles.formSection}>
            <h3>{fr ? section.title.fr : section.title.en}</h3>
            {section.lines.map(line => (
              <div
                key={line.kind === "pair" ? line.base : line.box}
                className={`${styles.formLine} ${line.total ? styles.formTotal : ""}`}
                style={{ paddingLeft: line.depth * 14 }}
              >
                <span>{fr ? line.label.fr : line.label.en}</span>
                {line.kind === "pair" ? (
                  <>
                    <code>{line.base}</code>
                    <strong>{amount(boxes[line.base], locale)}</strong>
                    <code>{line.tax}</code>
                    <strong>{amount(boxes[line.tax], locale)}</strong>
                  </>
                ) : (
                  <>
                    <span />
                    <span />
                    <code>{line.box}</code>
                    <strong>{amount(boxes[line.box], locale)}</strong>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
        {vatReturn.issues.length ? (
          <div className={styles.notice}>
            <AlertTriangle />
            <div>
              <strong>
                {fr
                  ? `${vatReturn.issues.length} opération(s) non reprise(s) dans la déclaration`
                  : `${vatReturn.issues.length} item(s) not included in the return`}
              </strong>
              <ul className={styles.issueList}>
                {vatReturn.issues.map(issue => (
                  <li key={issue.code + issue.itemId}>
                    {issue.label || (fr ? "Opération" : "Item")} · {money(issue.amount, currency, locale)} —{" "}
                    {fr ? ISSUE_TEXT[issue.code].fr : ISSUE_TEXT[issue.code].en}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {vatReturn.reconciled ? (
          <div className={styles.clear}>
            <CheckCircle2 />
            {fr
              ? `Concorde avec le grand livre : TVA en aval ${money(vatReturn.ledger.output, currency, locale)} (461411), TVA déductible ${money(vatReturn.ledger.input, currency, locale)} (421611).`
              : `Agrees with the ledger: output VAT ${money(vatReturn.ledger.output, currency, locale)} (461411), deductible VAT ${money(vatReturn.ledger.input, currency, locale)} (421611).`}
          </div>
        ) : (
          <div className={styles.notice}>
            <AlertTriangle />
            {fr
              ? `Écart avec le grand livre : TVA en aval ${money(vatReturn.ledger.output, currency, locale)} (461411) contre ${money(output, currency, locale)} en case 076 ; TVA déductible ${money(vatReturn.ledger.input, currency, locale)} (421611) contre ${money(input, currency, locale)} en case 102. Réglez les opérations ci-dessus ou vérifiez les écritures manuelles sur ces comptes.`
              : `Difference with the ledger: output VAT ${money(vatReturn.ledger.output, currency, locale)} (461411) against ${money(output, currency, locale)} in box 076; deductible VAT ${money(vatReturn.ledger.input, currency, locale)} (421611) against ${money(input, currency, locale)} in box 102. Resolve the items above or check manual entries on these accounts.`}
          </div>
        )}
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.head}>
            <div>
              <p>{fr ? "Déclarations UE" : "EU reporting"}</p>
              <h2>{fr ? "Signal pour l'état récapitulatif" : "Recapitulative statement signal"}</h2>
            </div>
            <Landmark />
          </div>
          <div className={styles.big}>
            {money(recapBase, currency, locale)}
            <small>{fr ? "Cases 457 / 013 et 423" : "Boxes 457 / 013 and 423"}</small>
          </div>
          {recapBase > 0 ? (
            <div className={styles.notice}>
              <AlertTriangle />
              {fr
                ? "Un montant en case 457, 013 ou 423 entraîne l'obligation de déposer un état récapitulatif (formulaire eCDF séparé)."
                : "An amount in box 457, 013 or 423 entails the obligation to file a recapitulative statement (separate eCDF form)."}
            </div>
          ) : (
            <div className={styles.clear}>
              <CheckCircle2 />
              {fr
                ? "Aucune livraison ni prestation B2B vers l'UE sur la période."
                : "No B2B supplies to other EU countries in this period."}
            </div>
          )}
        </article>
        <article className={styles.card}>
          <div className={styles.head}>
            <div>
              <p>{fr ? `Préparation · ${periodLabel(period.key)}` : `Readiness · ${periodLabel(period.key)}`}</p>
              <h2>
                {ready
                  ? fr
                    ? "Prêt pour la vérification de la déclaration"
                    : "Ready for filing review"
                  : fr
                    ? "Documents encore nécessaires"
                    : "Documents still needed"}
              </h2>
            </div>
            {ready ? <CheckCircle2 /> : <AlertTriangle />}
          </div>
          <div className={styles.check}>
            <span>{fr ? "Comptabilité non vérifiée" : "Unreviewed bookkeeping"}</span>
            <strong>{pendingCount ?? 0}</strong>
          </div>
          <div className={styles.check}>
            <span>{fr ? "Mouvements bancaires sans justificatif TVA" : "Bank movements without VAT evidence"}</span>
            <strong>{bankEvidenceMissing}</strong>
          </div>
          <div className={styles.check}>
            <span>{fr ? "Éléments non bancaires au traitement inconnu" : "Non-bank items with unknown treatment"}</span>
            <strong>{unknownNonBank}</strong>
          </div>
          <div className={styles.check}>
            <span>{fr ? "Opérations à préciser pour la déclaration" : "Items to clarify for the return"}</span>
            <strong>{vatReturn.issues.length}</strong>
          </div>
          {bankEvidenceMissing > 0 ? (
            <div className={styles.notice}>
              <AlertTriangle />
              {fr
                ? "Il ne s'agit pas d'erreurs TVA '349'. Une ligne bancaire seule ne prouve pas une TVA déductible ou collectée. Joignez les factures ou reçus, ou confirmez que la transaction est hors TVA, avant le dépôt."
                : "These are not 349 VAT errors. A bank line alone does not prove deductible/output VAT. Attach invoices or receipts, or confirm the transaction is outside VAT, before filing."}
            </div>
          ) : (
            <div className={styles.clear}>
              <CheckCircle2 />
              {fr
                ? "Toute l'activité bancaire comptabilisée possède un traitement TVA/justificatif explicite."
                : "All posted bank activity has an explicit VAT/evidence treatment."}
            </div>
          )}
          <VatFilingAction period={period.key} ready={ready} />
          {(filings ?? []).length ? (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--z-border)", paddingTop: 10 }}>
              <strong style={{ fontSize: 12 }}>
                {fr ? "Instantanés préparés pour cette période" : "Snapshots prepared for this period"}
              </strong>
              {(filings ?? []).slice(0, 3).map(f => (
                <div
                  key={f.id}
                  style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "6px 0" }}
                >
                  <span>{f.snapshot_at ? new Date(f.snapshot_at).toLocaleDateString(dateLocale) : f.period_label}</span>
                  <b>{f.export_status}</b>
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.export}>
            <FileOutput />
            <div>
              <strong>{fr ? "La soumission reste sous votre contrôle" : "Submission stays controlled"}</strong>
              <p>
                {fr
                  ? "Zuelen fige les cases de la déclaration et les écritures qui les justifient. Le dépôt se fait sur eCDF / MyGuichet avec ces montants ; Zuelen ne dépose rien à votre place."
                  : "Zuelen freezes the return boxes and the entries behind them. You file on eCDF / MyGuichet with these amounts; Zuelen does not file anything for you."}
              </p>
            </div>
          </div>
        </article>
      </section>
    </V2Page>
  );
}
