import { Check, ShieldCheck } from "lucide-react";
import { ProfessionalFrame } from "@/components/professional-frame";
import { ACCOUNTANT_BUSINESS_TYPES, ACCOUNTANT_LANGUAGES, ACCOUNTANT_SPECIALTIES, accountantBusinessTypeLabel, accountantInitials, accountantLanguageLabel, accountantSpecialtyLabel } from "@/lib/accountants";
import { normalizeLocale } from "@/lib/i18n";
import { getProfessionalWorkspace } from "@/lib/professional-workspace";
import { saveAccountantProfileAction } from "@/app/accountants/manage/actions";
import styles from "../professional.module.css";

export const dynamic = "force-dynamic";

export default async function ProfessionalProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { workspace, profile, subscription } = await getProfessionalWorkspace(true);
  const params = await searchParams;
  if (!profile) return null;
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;

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
      <div className={styles.pageHead}>
        <div><span>{l("Professional profile", "Profil professionnel")}</span><h1>{l("My profile", "Mon profil")}</h1><p>{l("Keep your public listing accurate and useful. Profile changes may be reviewed before they become visible in the directory.", "Gardez votre profil public précis et utile. Certaines modifications peuvent être vérifiées avant leur publication dans l’annuaire.")}</p></div>
      </div>
      {params.saved ? <div className={styles.notice}><Check size={15}/> {l("Profile saved successfully. Material changes will be reviewed before publication.", "Profil enregistré. Les modifications importantes seront vérifiées avant publication.")}</div> : null}

      <form action={saveAccountantProfileAction} encType="multipart/form-data" className={`${styles.card} ${styles.form}`}>
        <input type="hidden" name="return_to" value="/professional/profile?saved=1"/>
        <div className={styles.sectionHead}>
          <div><span>{l("Listing details", "Informations du profil")}</span><h2>{l("Edit your professional presence", "Modifier votre présence professionnelle")}</h2></div>
          <div className={styles.avatarEdit}>{profile.photo_url ? <img src={profile.photo_url} alt=""/> : <span>{accountantInitials(profile.full_name)}</span>}</div>
        </div>

        <div className={styles.formGrid}>
          <label><span>{l("Full name *", "Nom complet *")}</span><input name="full_name" required defaultValue={profile.full_name}/></label>
          <label><span>{l("Firm / practice", "Fiduciaire / cabinet")}</span><input name="firm_name" defaultValue={profile.firm_name ?? ""} placeholder="Dupont Fiduciaire"/></label>
          <label><span>{l("Professional title *", "Titre professionnel *")}</span><input name="professional_title" required defaultValue={profile.professional_title}/></label>
          <label><span>{l("Years of experience", "Années d’expérience")}</span><input name="years_experience" type="number" min="0" max="80" defaultValue={profile.years_experience ?? ""}/></label>
          <label><span>{l("Location", "Localisation")}</span><input name="location" defaultValue={profile.location ?? "Luxembourg"}/></label>
          <label><span>{l("Contact email *", "E-mail de contact *")}</span><input name="email" type="email" required defaultValue={profile.email ?? workspace.email ?? ""}/></label>
          <label><span>{l("Phone", "Téléphone")}</span><input name="phone" defaultValue={profile.phone ?? ""} placeholder="+352 ..."/></label>
          <label><span>{l("Website", "Site web")}</span><input name="website" defaultValue={profile.website ?? ""} placeholder="yourfirm.lu"/></label>
          <label><span>{l("Portfolio / professional profile", "Portfolio / profil professionnel")}</span><input name="portfolio_url" defaultValue={profile.portfolio_url ?? ""} placeholder="linkedin.com/in/..."/></label>
          <label><span>{l("Profile photo", "Photo de profil")}</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPG, PNG or WebP · max 5 MB</small></label>
          <label className={styles.full}><span>{l("About your practice", "À propos de votre activité")}</span><textarea name="bio" rows={5} defaultValue={profile.bio ?? ""}/></label>
          <label className={styles.full}><span>{l("Qualifications", "Qualifications")}</span><textarea name="qualifications" rows={3} defaultValue={profile.qualifications ?? ""}/></label>
          <label className={styles.full}><span>{l("Client references", "Références clients")}</span><textarea name="client_references" rows={3} defaultValue={profile.client_references ?? ""} placeholder={l("Optional representative clients, references or credibility notes.", "Clients représentatifs, références ou éléments de crédibilité facultatifs.")}/></label>
        </div>

        <fieldset><legend>{l("Languages *", "Langues *")}</legend><div className={styles.checkChips}>{ACCOUNTANT_LANGUAGES.map(value => <label key={value}><input type="checkbox" name="languages" value={value} defaultChecked={profile.languages.includes(value)}/><span>{accountantLanguageLabel(value,locale,true)}</span></label>)}</div></fieldset>
        <fieldset><legend>{l("Specialties *", "Spécialités *")}</legend><div className={styles.checkChips}>{ACCOUNTANT_SPECIALTIES.map(value => <label key={value}><input type="checkbox" name="specialties" value={value} defaultChecked={profile.specialties.includes(value)}/><span>{accountantSpecialtyLabel(value,locale)}</span></label>)}</div></fieldset>
        <fieldset><legend>{l("Businesses you work with", "Entreprises accompagnées")}</legend><div className={styles.checkChips}>{ACCOUNTANT_BUSINESS_TYPES.map(value => <label key={value}><input type="checkbox" name="business_types" value={value} defaultChecked={profile.business_types.includes(value)}/><span>{accountantBusinessTypeLabel(value,locale)}</span></label>)}</div></fieldset>

        <div className={styles.toggles}>
          <label><input type="checkbox" name="accepting_new_clients" defaultChecked={profile.accepting_new_clients}/><span><strong>{l("Accepting new clients", "Accepte de nouveaux clients")}</strong><small>{l("Show businesses that you are open to enquiries.", "Indiquez aux entreprises que vous acceptez de nouvelles demandes.")}</small></span></label>
          <label><input type="checkbox" name="works_remotely" defaultChecked={profile.works_remotely}/><span><strong>{l("Remote", "À distance")}</strong><small>{l("You can work with clients remotely.", "Vous pouvez accompagner des clients à distance.")}</small></span></label>
          <label><input type="checkbox" name="works_in_person" defaultChecked={profile.works_in_person}/><span><strong>{l("In person", "En personne")}</strong><small>{l("You meet clients in Luxembourg.", "Vous recevez des clients au Luxembourg.")}</small></span></label>
        </div>

        <div className={styles.formFooter}>
          <p className={styles.reviewNote}><ShieldCheck size={14}/> {l("New listings and material profile changes are reviewed by Zuelen.", "Les nouveaux profils et les modifications importantes sont vérifiés par Zuelen.")}</p>
          <button className={styles.primary} type="submit">{l("Save profile", "Enregistrer le profil")}</button>
        </div>
      </form>
    </div>
  </ProfessionalFrame>;
}
