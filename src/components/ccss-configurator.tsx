"use client";

import { CalendarPlus2, FileCheck2, LoaderCircle, Settings2, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveCcssConfiguration, saveCcssStatement, type CcssActionState } from "@/app/app/ccss/actions";
import { FieldGroup, FormSection, SelectField, TextareaField, TextField, ToggleField } from "@/components/zuelen-form-ui-v2";
import styles from "./ccss-configurator.module.css";

type FiscalProfile = {
  residency_status: string;
  civil_status: string;
  civil_status_event_date: string | null;
  qualifying_children_count: number;
  age_64_at_year_start: boolean;
  taxation_mode: string;
  partnership_full_year_conditions_met: boolean;
  legally_recognized_separation: boolean;
  transitional_class_2_used_in_prior_five_years: boolean;
  manual_tax_class_override: string | null;
  acd_tax_rate_percent: number | string | null;
  override_source: string | null;
  override_reason: string | null;
};

type CcssProfile = {
  affiliation_type: string;
  activity_legal_form: string;
  affiliation_start_date: string;
  estimated_annual_professional_income: number | string;
  income_status: string;
  income_source: string;
  aaa_factor: number | string;
  mde_membership: string;
  mde_class: number | null;
  confirmed_monthly_normal_base: number | string | null;
  confirmed_monthly_pension_base: number | string | null;
  confirmed_monthly_dependency_base: number | string | null;
  pension_reduction_status: string;
  insignificant_income_exemption_status: string;
  assisting_spouse_enabled: boolean;
  assisting_spouse_main_activity: boolean;
};

type DocumentOption = { id: string; file_name: string };
const initialState: CcssActionState = { status: "idle", message: "" };

export function CcssConfigurator({
  year,
  locale,
  fiscalProfile,
  ccssProfile,
  defaultLegalForm,
  documents,
}: {
  year: number;
  locale: "en" | "fr";
  fiscalProfile: FiscalProfile | null;
  ccssProfile: CcssProfile | null;
  defaultLegalForm: "own_name" | "company";
  documents: DocumentOption[];
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const configDialog = useRef<HTMLDialogElement>(null);
  const statementDialog = useRef<HTMLDialogElement>(null);
  const configForm = useRef<HTMLFormElement>(null);
  const statementForm = useRef<HTMLFormElement>(null);
  const [configState, configAction, configPending] = useActionState(saveCcssConfiguration, initialState);
  const [statementState, statementAction, statementPending] = useActionState(saveCcssStatement, initialState);
  const [civilStatus, setCivilStatus] = useState(fiscalProfile?.civil_status ?? "single");
  const [residency, setResidency] = useState(fiscalProfile?.residency_status ?? "resident");
  const [taxationMode, setTaxationMode] = useState(fiscalProfile?.taxation_mode ?? "not_applicable");
  const [affiliationType, setAffiliationType] = useState(ccssProfile?.affiliation_type ?? (defaultLegalForm === "company" ? "manager" : "principal"));
  const [legalForm, setLegalForm] = useState(ccssProfile?.activity_legal_form ?? defaultLegalForm);
  const [mdeMembership, setMdeMembership] = useState(ccssProfile?.mde_membership ?? "not_affiliated");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const l = (en: string, french: string) => fr ? french : en;
  const close = (dialog: React.RefObject<HTMLDialogElement | null>) => dialog.current?.close();
  const changeAffiliationType = (next: string) => {
    setAffiliationType(next);
    if (next === "manager") setLegalForm("company");
  };
  const open = (
    dialog: React.RefObject<HTMLDialogElement | null>,
    form: React.RefObject<HTMLFormElement | null>,
  ) => {
    dialog.current?.showModal();
    requestAnimationFrame(() => {
      if (form.current) form.current.scrollTop = 0;
    });
  };

  useEffect(() => {
    if (configState.status !== "success") return;
    configDialog.current?.close();
    router.refresh();
  }, [configState, router]);

  return <>
    <div className={styles.actions}>
      <button type="button" className={styles.primary} onClick={() => open(configDialog, configForm)}><Settings2 size={15}/>{l("Configure my situation", "Configurer ma situation")}</button>
      {ccssProfile ? <button type="button" className={styles.secondary} onClick={() => open(statementDialog, statementForm)}><CalendarPlus2 size={15}/>{l("Record statement", "Enregistrer un extrait")}</button> : null}
    </div>

    <dialog ref={configDialog} className={styles.dialog} aria-labelledby="ccss-config-title" onCancel={() => close(configDialog)}>
      <div className={styles.dialogShell}>
        <header className={styles.dialogHeader}><div><span>CCSS · {year}</span><h2 id="ccss-config-title">{l("Configure your situation", "Configurer votre situation")}</h2><p>{l("Confirm the professional income and affiliation facts that CCSS uses. Your personal tax situation remains separate.", "Confirmez le revenu professionnel et les éléments d’affiliation utilisés par le CCSS. Votre situation fiscale personnelle reste distincte.")}</p></div><button type="button" onClick={() => close(configDialog)} aria-label={l("Close", "Fermer")}><X size={18}/></button></header>
        <form ref={configForm} action={configAction} className={styles.form}>
          <input type="hidden" name="tax_year" value={year}/>
          <FormSection title={l("CCSS affiliation", "Affiliation CCSS")} description={l("This determines contribution bases. It does not use your tax class.", "Cette section détermine les assiettes de cotisation. Elle n’utilise pas votre classe d’impôt.")}>
            <FieldGroup columns={2}>
              <SelectField label={l("Affiliation status", "Statut d’affiliation")} name="affiliation_type" value={affiliationType} onChange={(event) => changeAffiliationType(event.target.value)} required>
                <option value="principal">{l("Principal self-employed activity", "Activité indépendante principale")}</option>
                <option value="secondary">{l("Accessory activity with salaried work", "Activité accessoire avec emploi salarié")}</option>
                <option value="manager">{l("Independent company manager/director", "Dirigeant de société affilié comme indépendant")}</option>
              </SelectField>
              <SelectField label={l("Activity carried on through", "Activité exercée")} name="activity_legal_form" value={legalForm} onChange={(event) => setLegalForm(event.target.value)} required>
                {affiliationType !== "manager" ? <option value="own_name">{l("My own name / sole activity", "En mon nom propre")}</option> : null}
                <option value="company">{l("SARL, SARL-S or another company", "SARL, SARL-S ou autre société")}</option>
              </SelectField>
              <TextField label={l("Affiliation start date", "Date de début d’affiliation")} name="affiliation_start_date" type="date" defaultValue={ccssProfile?.affiliation_start_date ?? `${year}-01-01`} required/>
              <TextField label={l("Estimated annual professional income", "Revenu professionnel annuel estimé")} description={legalForm === "company" ? l("Use your manager/director remuneration — never company turnover or corporate profit.", "Utilisez votre rémunération de dirigeant — jamais le chiffre d’affaires ni le bénéfice de la société.") : l("For an activity in your own name, confirmed net professional profit may be used as a proxy.", "Pour une activité en nom propre, le bénéfice professionnel net confirmé peut servir d’indicateur.")} name="estimated_annual_professional_income" type="number" min="0" step="0.01" defaultValue={ccssProfile?.estimated_annual_professional_income ?? ""} placeholder="33255.96" required/>
              <SelectField label={l("Income status", "Statut du revenu")} name="income_status" defaultValue={ccssProfile?.income_status ?? "provisional"} required>
                <option value="provisional">{l("Provisional estimate", "Estimation provisoire")}</option>
                <option value="user_confirmed">{l("Confirmed by me", "Confirmé par moi")}</option>
                <option value="final_acd">{l("Final / ACD-confirmed", "Définitif / confirmé par l’ACD")}</option>
              </SelectField>
              <SelectField label={l("Income source", "Source du revenu")} name="income_source" defaultValue={ccssProfile?.income_source ?? (affiliationType === "manager" ? "manager_remuneration" : "manual")} required>
                <option value="manual">{l("Manual confirmation", "Confirmation manuelle")}</option>
                {legalForm === "own_name" ? <option value="accounting_proxy">{l("Accounting-derived net-profit proxy", "Indicateur de bénéfice net comptable")}</option> : null}
                <option value="manager_remuneration">{l("Manager/director remuneration", "Rémunération de dirigeant")}</option>
                <option value="acd_final">{l("Final professional income from ACD", "Revenu professionnel définitif ACD")}</option>
              </SelectField>
            </FieldGroup>
          </FormSection>

          <FormSection title={l("Rates, reliefs and MDE", "Taux, allègements et MDE")} description={l("Reliefs are never activated automatically. MDE class is separate from personal tax class.", "Les allègements ne sont jamais activés automatiquement. La classe MDE est distincte de la classe d’impôt.")}>
            <FieldGroup columns={3}>
              <SelectField label={l("AAA accident factor", "Facteur accident AAA")} name="aaa_factor" defaultValue={String(ccssProfile?.aaa_factor ?? "1.0000")} required>
                <option value="0.8500">0.85</option><option value="1.0000">1.00</option><option value="1.1000">1.10</option><option value="1.3000">1.30</option><option value="1.5000">1.50</option>
              </SelectField>
              <SelectField label={l("MDE membership", "Affiliation MDE")} name="mde_membership" value={mdeMembership} onChange={(event) => setMdeMembership(event.target.value)} required>
                <option value="not_affiliated">{l("Not affiliated", "Non affilié")}</option><option value="affiliated">{l("Affiliated", "Affilié")}</option>
              </SelectField>
              <SelectField label={l("MDE class", "Classe MDE")} name="mde_class" defaultValue={String(ccssProfile?.mde_class ?? 2)} disabled={mdeMembership !== "affiliated"} required={mdeMembership === "affiliated"}>
                <option value="1">1</option><option value="2">2 · {l("usual new member", "nouveau membre en principe")}</option><option value="3">3</option><option value="4">4</option>
              </SelectField>
              <SelectField label={l("Pension-base reduction", "Réduction de l’assiette pension")} name="pension_reduction_status" defaultValue={ccssProfile?.pension_reduction_status ?? "not_requested"} required>
                <option value="not_requested">{l("Not requested", "Non demandée")}</option><option value="requested">{l("Requested — assumption", "Demandée — hypothèse")}</option><option value="approved">{l("Approved by CCSS", "Approuvée par le CCSS")}</option>
              </SelectField>
              <SelectField label={l("Insignificant-income exemption", "Dispense pour revenu insignifiant")} name="insignificant_income_exemption_status" defaultValue={ccssProfile?.insignificant_income_exemption_status ?? "not_requested"} required>
                <option value="not_requested">{l("Not requested", "Non demandée")}</option><option value="requested">{l("Requested — assumption", "Demandée — hypothèse")}</option><option value="approved">{l("Approved by CCSS", "Approuvée par le CCSS")}</option>
              </SelectField>
            </FieldGroup>
            <FieldGroup columns={3}>
              <TextField label={l("Confirmed normal monthly base", "Assiette mensuelle normale confirmée")} description={l("Optional — copy only from a current CCSS statement.", "Facultatif — recopiez uniquement une assiette figurant sur un extrait CCSS actuel.")} name="confirmed_monthly_normal_base" type="number" min="0" step="0.01" defaultValue={ccssProfile?.confirmed_monthly_normal_base ?? ""}/>
              <TextField label={l("Confirmed pension monthly base", "Assiette mensuelle pension confirmée")} description={l("Use the reduced base only when CCSS approved it.", "Utilisez l’assiette réduite uniquement après approbation du CCSS.")} name="confirmed_monthly_pension_base" type="number" min="0" step="0.01" defaultValue={ccssProfile?.confirmed_monthly_pension_base ?? ""}/>
              <TextField label={l("Confirmed dependency monthly base", "Assiette mensuelle dépendance confirmée")} description={l("Optional — as printed on the CCSS statement.", "Facultatif — telle qu’indiquée sur l’extrait CCSS.")} name="confirmed_monthly_dependency_base" type="number" min="0" step="0.01" defaultValue={ccssProfile?.confirmed_monthly_dependency_base ?? ""}/>
            </FieldGroup>
          </FormSection>

          <FormSection title={l("Assisting spouse or partner", "Conjoint ou partenaire aidant")} description={legalForm === "company" ? l("A spouse working for your company is normally affiliated as that company’s employee, not as an assisting spouse.", "Le conjoint travaillant pour votre société est normalement affilié comme salarié de celle-ci, et non comme conjoint aidant.") : l("Marriage alone changes nothing. Enable this only when the spouse’s main activity genuinely assists your own-name activity.", "Le mariage seul ne change rien. Activez cette option uniquement si l’activité principale du conjoint consiste réellement à aider votre activité en nom propre.")}>
            <ToggleField title={l("Apply an assisting-spouse estimate", "Appliquer une estimation de conjoint aidant")} description={l("Requires marriage/qualifying partnership, genuine main assistance and an own-name activity.", "Nécessite un mariage/partenariat admissible, une aide principale réelle et une activité en nom propre.")} name="assisting_spouse_enabled" defaultChecked={ccssProfile?.assisting_spouse_enabled} disabled={legalForm === "company" || !["married", "registered_partnership"].includes(civilStatus)}/>
            <ToggleField title={l("Assisting is the spouse/partner’s main activity", "L’aide constitue l’activité principale du conjoint/partenaire")} name="assisting_spouse_main_activity" defaultChecked={ccssProfile?.assisting_spouse_main_activity} disabled={legalForm === "company"}/>
          </FormSection>

          <FormSection title={l("Personal fiscal profile", "Profil fiscal personnel")} description={l("These facts derive a likely Luxembourg tax class for planning. They never enter the CCSS formula.", "Ces éléments servent à déterminer une classe d’impôt luxembourgeoise probable pour la planification. Ils n’entrent jamais dans la formule CCSS.")}>
            <FieldGroup columns={2}>
              <SelectField label={l("Tax residency", "Résidence fiscale")} name="residency_status" value={residency} onChange={(event) => setResidency(event.target.value)} required>
                <option value="resident">{l("Luxembourg resident", "Résident luxembourgeois")}</option><option value="non_resident">{l("Non-resident", "Non-résident")}</option>
              </SelectField>
              <SelectField label={l("Civil status", "État civil")} name="civil_status" value={civilStatus} onChange={(event) => setCivilStatus(event.target.value)} required>
                <option value="single">{l("Single", "Célibataire")}</option><option value="married">{l("Married", "Marié(e)")}</option><option value="registered_partnership">{l("Registered partnership", "Partenariat enregistré")}</option><option value="divorced">{l("Divorced", "Divorcé(e)")}</option><option value="separated">{l("Legally separated", "Séparé(e) légalement")}</option><option value="widowed">{l("Widowed", "Veuf / veuve")}</option>
              </SelectField>
              <TextField label={l("Civil-status event date", "Date de l’événement d’état civil")} description={l("Needed for widowhood, divorce and recognized-separation transition rules.", "Nécessaire pour les règles transitoires en cas de veuvage, divorce ou séparation reconnue.")} name="civil_status_event_date" type="date" defaultValue={fiscalProfile?.civil_status_event_date ?? ""}/>
              <TextField label={l("Qualifying children", "Enfants ouvrant droit à la modération")} name="qualifying_children_count" type="number" min="0" max="30" step="1" defaultValue={fiscalProfile?.qualifying_children_count ?? 0} required/>
              <SelectField label={l("Taxation mode", "Mode d’imposition")} name="taxation_mode" value={taxationMode} onChange={(event) => setTaxationMode(event.target.value)} required>
                <option value="not_applicable">{l("Not applicable", "Non applicable")}</option><option value="joint">{l("Joint / collective", "Collective")}</option><option value="individual">{l("Individual", "Individuelle")}</option><option value="individual_reallocation">{l("Individual with reallocation", "Individuelle avec réallocation")}</option><option value="needs_confirmation">{l("Needs ACD confirmation", "À confirmer auprès de l’ACD")}</option>
              </SelectField>
            </FieldGroup>
            <ToggleField title={l("At least 64 at the beginning of the tax year", "Âgé(e) d’au moins 64 ans au début de l’année fiscale")} name="age_64_at_year_start" defaultChecked={fiscalProfile?.age_64_at_year_start}/>
            <ToggleField title={l("Registered partnership and common household covered the full tax year", "Partenariat et ménage commun pendant toute l’année fiscale")} name="partnership_full_year_conditions_met" defaultChecked={fiscalProfile?.partnership_full_year_conditions_met} disabled={civilStatus !== "registered_partnership"}/>
            <ToggleField title={l("Separation is legally or judicially recognized", "La séparation est reconnue légalement ou judiciairement")} name="legally_recognized_separation" defaultChecked={fiscalProfile?.legally_recognized_separation} disabled={civilStatus !== "separated"}/>
            <ToggleField title={l("Transitional class 2 was already used in the preceding five years", "La classe 2 transitoire a déjà été utilisée au cours des cinq années précédentes")} name="transitional_class_2_used_in_prior_five_years" defaultChecked={fiscalProfile?.transitional_class_2_used_in_prior_five_years} disabled={!['divorced','separated'].includes(civilStatus)}/>
            {residency === "non_resident" ? <div className={styles.contextNote}><ShieldCheck size={16}/><span>{l("Non-resident class/rate rules require information beyond marital status. Confirm the class or ACD rate from your tax documents.", "Les règles de classe/taux des non-résidents exigent plus que l’état civil. Confirmez la classe ou le taux ACD à partir de vos documents fiscaux.")}</span></div> : null}
            <FieldGroup columns={2}>
              <SelectField label={l("Manual tax-class confirmation", "Confirmation manuelle de la classe d’impôt")} name="manual_tax_class_override" defaultValue={fiscalProfile?.manual_tax_class_override ?? ""}>
                <option value="">{l("Use derived class", "Utiliser la classe déterminée")}</option><option value="1">1</option><option value="1a">1a</option><option value="2">2</option>
              </SelectField>
              <TextField label={l("ACD rate, if shown (%)", "Taux ACD, s’il est indiqué (%)")} name="acd_tax_rate_percent" type="number" min="0" max="100" step="0.0001" defaultValue={fiscalProfile?.acd_tax_rate_percent ?? ""}/>
              <SelectField label={l("Confirmation source", "Source de confirmation")} name="override_source" defaultValue={fiscalProfile?.override_source ?? ""}>
                <option value="">{l("No manual source", "Aucune source manuelle")}</option><option value="ACD tax card">{l("ACD tax card", "Fiche de retenue ACD")}</option><option value="ACD assessment">{l("ACD assessment", "Bulletin d’imposition ACD")}</option>
              </SelectField>
              <TextareaField label={l("Reason or reference", "Motif ou référence")} name="override_reason" defaultValue={fiscalProfile?.override_reason ?? ""}/>
            </FieldGroup>
          </FormSection>
          {configState.message ? <p className={configState.status === "error" ? styles.error : styles.success} role="status">{configState.message}</p> : null}
          <footer className={styles.formFooter}><button type="button" className={styles.cancel} onClick={() => close(configDialog)}>{l("Cancel", "Annuler")}</button><button type="submit" className={styles.primary} disabled={configPending}>{configPending ? <LoaderCircle className={styles.spin} size={15}/> : <FileCheck2 size={15}/>} {l(configPending ? "Saving…" : "Save and confirm", configPending ? "Enregistrement…" : "Enregistrer et confirmer")}</button></footer>
        </form>
      </div>
    </dialog>

    <dialog ref={statementDialog} className={styles.dialog} aria-labelledby="ccss-statement-title" onCancel={() => close(statementDialog)}>
      <div className={`${styles.dialogShell} ${styles.statementShell}`}>
        <header className={styles.dialogHeader}><div><span>{l("From CCSS statement", "Depuis l’extrait CCSS")}</span><h2 id="ccss-statement-title">{l("Record an actual statement", "Enregistrer un extrait réel")}</h2><p>{l("The due date is calculated as 10 days after the issue date — never from an invented recurring day.", "L’échéance est calculée à 10 jours après la date d’émission — jamais à partir d’un jour mensuel inventé.")}</p></div><button type="button" onClick={() => close(statementDialog)} aria-label={l("Close", "Fermer")}><X size={18}/></button></header>
        <form ref={statementForm} action={statementAction} className={styles.form}>
          <input type="hidden" name="tax_year" value={year}/>
          <FieldGroup columns={2}>
            <TextField label={l("Contribution period", "Période de cotisation")} name="contribution_period" type="month" defaultValue={`${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`} required/>
            <TextField label={l("Statement issue date", "Date d’émission de l’extrait")} name="statement_issue_date" type="date" required/>
            <TextField label={l("Amount due", "Montant dû")} name="amount_due" type="number" min="0" step="0.01" required/>
            <SelectField label={l("Payment status", "Statut de paiement")} name="payment_status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} required>
              <option value="unpaid">{l("Unpaid", "À payer")}</option><option value="paid">{l("Paid", "Payé")}</option><option value="disputed">{l("Disputed / verify", "Contesté / à vérifier")}</option>
            </SelectField>
            {paymentStatus === "paid" ? <TextField label={l("Paid date", "Date de paiement")} name="paid_date" type="date" required/> : null}
            <SelectField label={l("Source document", "Document source")} name="source_document_id" description={l("Optional link for future document extraction.", "Lien facultatif pour une future extraction documentaire.")}>
              <option value="">{l("No linked document", "Aucun document lié")}</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.file_name}</option>)}
            </SelectField>
          </FieldGroup>
          {statementState.message ? <p className={statementState.status === "error" ? styles.error : styles.success} role="status">{statementState.message}</p> : null}
          <footer className={styles.formFooter}><button type="button" className={styles.cancel} onClick={() => close(statementDialog)}>{l("Cancel", "Annuler")}</button><button type="submit" className={styles.primary} disabled={statementPending}>{statementPending ? <LoaderCircle className={styles.spin} size={15}/> : <FileCheck2 size={15}/>} {l(statementPending ? "Saving…" : "Record statement", statementPending ? "Enregistrement…" : "Enregistrer l’extrait")}</button></footer>
        </form>
      </div>
    </dialog>
  </>;
}
