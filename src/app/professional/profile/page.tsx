import { Check, ShieldCheck } from "lucide-react";
import { ProfessionalFrame } from "@/components/professional-frame";
import { ACCOUNTANT_BUSINESS_TYPES, ACCOUNTANT_LANGUAGES, ACCOUNTANT_SPECIALTIES, accountantInitials, accountantLanguageLabel } from "@/lib/accountants";
import { getProfessionalWorkspace } from "@/lib/professional-workspace";
import { saveAccountantProfileAction } from "@/app/accountants/manage/actions";
import styles from "../professional.module.css";

export const dynamic = "force-dynamic";

export default async function ProfessionalProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { workspace, profile, subscription } = await getProfessionalWorkspace(true);
  const params = await searchParams;
  if (!profile) return null;

  return <ProfessionalFrame
    name={profile.full_name || workspace.profile?.full_name || workspace.email || "Accountant"}
    firmName={profile.firm_name}
    email={workspace.email}
    photoUrl={profile.photo_url}
    approvalStatus={profile.approval_status}
    plan={subscription?.tier ?? null}
    hasBusinessWorkspace={Boolean(workspace.company)}
  >
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div><span>Professional profile</span><h1>My profile</h1><p>Keep your public listing accurate and useful. Profile changes may be reviewed before they become visible in the directory.</p></div>
      </div>
      {params.saved ? <div className={styles.notice}><Check size={15}/> Profile saved successfully. Material changes will be reviewed before publication.</div> : null}

      <form action={saveAccountantProfileAction} encType="multipart/form-data" className={`${styles.card} ${styles.form}`}>
        <input type="hidden" name="return_to" value="/professional/profile?saved=1"/>
        <div className={styles.sectionHead}>
          <div><span>Listing details</span><h2>Edit your professional presence</h2></div>
          <div className={styles.avatarEdit}>{profile.photo_url ? <img src={profile.photo_url} alt=""/> : <span>{accountantInitials(profile.full_name)}</span>}</div>
        </div>

        <div className={styles.formGrid}>
          <label><span>Full name *</span><input name="full_name" required defaultValue={profile.full_name}/></label>
          <label><span>Firm / practice</span><input name="firm_name" defaultValue={profile.firm_name ?? ""} placeholder="Dupont Fiduciaire"/></label>
          <label><span>Professional title *</span><input name="professional_title" required defaultValue={profile.professional_title}/></label>
          <label><span>Years of experience</span><input name="years_experience" type="number" min="0" max="80" defaultValue={profile.years_experience ?? ""}/></label>
          <label><span>Location</span><input name="location" defaultValue={profile.location ?? "Luxembourg"}/></label>
          <label><span>Contact email *</span><input name="email" type="email" required defaultValue={profile.email ?? workspace.email ?? ""}/></label>
          <label><span>Phone</span><input name="phone" defaultValue={profile.phone ?? ""} placeholder="+352 ..."/></label>
          <label><span>Website</span><input name="website" defaultValue={profile.website ?? ""} placeholder="yourfirm.lu"/></label>
          <label><span>Portfolio / professional profile</span><input name="portfolio_url" defaultValue={profile.portfolio_url ?? ""} placeholder="linkedin.com/in/..."/></label>
          <label><span>Profile photo</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPG, PNG or WebP · max 5 MB</small></label>
          <label className={styles.full}><span>About your practice</span><textarea name="bio" rows={5} defaultValue={profile.bio ?? ""}/></label>
          <label className={styles.full}><span>Qualifications</span><textarea name="qualifications" rows={3} defaultValue={profile.qualifications ?? ""}/></label>
          <label className={styles.full}><span>Client references</span><textarea name="client_references" rows={3} defaultValue={profile.client_references ?? ""} placeholder="Optional representative clients, references or credibility notes."/></label>
        </div>

        <fieldset><legend>Languages *</legend><div className={styles.checkChips}>{ACCOUNTANT_LANGUAGES.map(value => <label key={value}><input type="checkbox" name="languages" value={value} defaultChecked={profile.languages.includes(value)}/><span>{accountantLanguageLabel(value,"en",true)}</span></label>)}</div></fieldset>
        <fieldset><legend>Specialties *</legend><div className={styles.checkChips}>{ACCOUNTANT_SPECIALTIES.map(value => <label key={value}><input type="checkbox" name="specialties" value={value} defaultChecked={profile.specialties.includes(value)}/><span>{value}</span></label>)}</div></fieldset>
        <fieldset><legend>Businesses you work with</legend><div className={styles.checkChips}>{ACCOUNTANT_BUSINESS_TYPES.map(value => <label key={value}><input type="checkbox" name="business_types" value={value} defaultChecked={profile.business_types.includes(value)}/><span>{value}</span></label>)}</div></fieldset>

        <div className={styles.toggles}>
          <label><input type="checkbox" name="accepting_new_clients" defaultChecked={profile.accepting_new_clients}/><span><strong>Accepting new clients</strong><small>Show businesses that you are open to enquiries.</small></span></label>
          <label><input type="checkbox" name="works_remotely" defaultChecked={profile.works_remotely}/><span><strong>Remote</strong><small>You can work with clients remotely.</small></span></label>
          <label><input type="checkbox" name="works_in_person" defaultChecked={profile.works_in_person}/><span><strong>In person</strong><small>You meet clients in Luxembourg.</small></span></label>
        </div>

        <div className={styles.formFooter}>
          <p className={styles.reviewNote}><ShieldCheck size={14}/> New listings and material profile changes are reviewed by Zuelen.</p>
          <button className={styles.primary} type="submit">Save profile</button>
        </div>
      </form>
    </div>
  </ProfessionalFrame>;
}
