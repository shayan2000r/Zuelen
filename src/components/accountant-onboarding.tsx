"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Check, ChevronLeft, CircleUserRound, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { ACCOUNTANT_BUSINESS_TYPES, ACCOUNTANT_LANGUAGES, ACCOUNTANT_SPECIALTIES, accountantInitials, accountantLanguageLabel, type AccountantListingSubscription, type AccountantProfile } from "@/lib/accountants";
import { saveAccountantProfileAction, startAccountantTrialAction } from "@/app/accountants/manage/actions";
import styles from "./accountant-onboarding.module.css";

type Props = {
  email: string | null;
  profile: AccountantProfile | null;
  subscription: AccountantListingSubscription | null;
  stripeConfigured: boolean;
  initialStep?: 1 | 2 | 3;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export function AccountantOnboarding({ email, profile, subscription, stripeConfigured, initialStep = 1 }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [contactEmail, setContactEmail] = useState(profile?.email ?? email ?? "");
  const canContinue = fullName.trim().length >= 2 && contactEmail.includes("@");
  const subscriptionOpen = Boolean(subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status));
  const trialUsed = Boolean(subscription?.trial_end);

  function progressState(index: 1 | 2 | 3) {
    if (index < step) return styles.completeStep;
    if (index === step) return styles.activeStep;
    return "";
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}><img src="/zuelen-icon.png" alt=""/><strong>Zuelen</strong><span>Professionals</span></Link>
        <div className={styles.secure}><ShieldCheck size={14}/> Secure professional onboarding</div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.intro}>
          <span className={styles.eyebrow}>Zuelen for accountants</span>
          <h1>Build a profile businesses can trust.</h1>
          <p>Tell us who you are, how you help Luxembourg businesses, and choose the visibility level that fits your practice.</p>
          <div className={styles.steps}>
            <div className={progressState(1)}><span>01</span><div><strong>Personal information</strong><small>Your identity and contact details</small></div></div>
            <div className={progressState(2)}><span>02</span><div><strong>Professional information</strong><small>Experience, expertise and clients</small></div></div>
            <div className={progressState(3)}><span>03</span><div><strong>Choose your plan</strong><small>Basic or Premium visibility</small></div></div>
          </div>
          <div className={styles.trust}><BadgeCheck size={18}/><div><strong>Every listing is reviewed.</strong><p>Your profile only becomes public after Zuelen approval and an eligible listing subscription.</p></div></div>
        </aside>

        <section className={styles.card}>
          {step < 3 ? (
            <form action={saveAccountantProfileAction} encType="multipart/form-data" className={styles.form}>
              <input type="hidden" name="return_to" value="/professional?step=3"/>

              <div hidden={step !== 1} className={styles.stepPanel}>
                <div className={styles.cardHead}><div className={styles.icon}><CircleUserRound size={21}/></div><div><span>Step 1 of 3</span><h2>Personal information</h2><p>Use the details businesses should see when they contact you.</p></div></div>
                <div className={styles.grid}>
                  <label><span>Full name *</span><input name="full_name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Marie Dupont" required/></label>
                  <label><span>Contact email *</span><input name="email" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder="marie@fiduciaire.lu" required/></label>
                  <label><span>Phone</span><input name="phone" defaultValue={profile?.phone ?? ""} placeholder="+352 621 000 000"/></label>
                  <label><span>Location</span><input name="location" defaultValue={profile?.location ?? "Luxembourg"} placeholder="Luxembourg City"/></label>
                  <label className={styles.full}><span>Profile photo</span><input className={styles.fileInput} name="photo" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPG, PNG or WebP · maximum 5 MB</small></label>
                </div>
                <div className={styles.previewLine}>{profile?.photo_url ? <img src={profile.photo_url} alt=""/> : <span>{accountantInitials(fullName || contactEmail || "A")}</span>}<div><strong>This is your professional identity.</strong><small>You can update these details later from your professional workspace.</small></div></div>
              </div>

              <div hidden={step !== 2} className={styles.stepPanel}>
                <div className={styles.cardHead}><div className={styles.icon}><BriefcaseBusiness size={21}/></div><div><span>Step 2 of 3</span><h2>Professional information</h2><p>Give businesses enough context to decide whether you are the right fit.</p></div></div>
                <div className={styles.grid}>
                  <label><span>Firm / practice</span><input name="firm_name" defaultValue={profile?.firm_name ?? ""} placeholder="Dupont Fiduciaire"/></label>
                  <label><span>Professional title *</span><input name="professional_title" defaultValue={profile?.professional_title ?? "Accountant"} placeholder="Accountant / Expert-comptable" required/></label>
                  <label><span>Years of experience</span><input name="years_experience" type="number" min="0" max="80" defaultValue={profile?.years_experience ?? ""} placeholder="8"/></label>
                  <label><span>Website</span><input name="website" defaultValue={profile?.website ?? ""} placeholder="yourfirm.lu"/></label>
                  <label className={styles.full}><span>Portfolio / professional profile</span><input name="portfolio_url" defaultValue={profile?.portfolio_url ?? ""} placeholder="linkedin.com/in/... or your portfolio URL"/></label>
                  <label className={styles.full}><span>About your practice</span><textarea name="bio" rows={4} defaultValue={profile?.bio ?? ""} placeholder="Explain who you help, how you work, and what clients can expect."/></label>
                  <label className={styles.full}><span>Qualifications</span><textarea name="qualifications" rows={3} defaultValue={profile?.qualifications ?? ""} placeholder="Degrees, certifications, professional memberships or relevant credentials."/></label>
                  <label className={styles.full}><span>Client references</span><textarea name="client_references" rows={3} defaultValue={profile?.client_references ?? ""} placeholder="Optional references, representative clients or short credibility notes."/></label>
                </div>

                <fieldset><legend>Languages *</legend><div className={styles.chips}>{ACCOUNTANT_LANGUAGES.map(value => <label key={value}><input type="checkbox" name="languages" value={value} defaultChecked={profile?.languages.includes(value)}/><span>{accountantLanguageLabel(value, "en", true)}</span></label>)}</div></fieldset>
                <fieldset><legend>Specialties *</legend><div className={styles.chips}>{ACCOUNTANT_SPECIALTIES.map(value => <label key={value}><input type="checkbox" name="specialties" value={value} defaultChecked={profile?.specialties.includes(value)}/><span>{value}</span></label>)}</div></fieldset>
                <fieldset><legend>Businesses you work with</legend><div className={styles.chips}>{ACCOUNTANT_BUSINESS_TYPES.map(value => <label key={value}><input type="checkbox" name="business_types" value={value} defaultChecked={profile?.business_types.includes(value)}/><span>{value}</span></label>)}</div></fieldset>

                <div className={styles.toggles}>
                  <label><input type="checkbox" name="accepting_new_clients" defaultChecked={profile?.accepting_new_clients ?? true}/><span><strong>Accepting new clients</strong><small>Show that you are currently open to enquiries.</small></span></label>
                  <label><input type="checkbox" name="works_remotely" defaultChecked={profile?.works_remotely ?? true}/><span><strong>Remote</strong><small>You can work with businesses remotely.</small></span></label>
                  <label><input type="checkbox" name="works_in_person" defaultChecked={profile?.works_in_person ?? true}/><span><strong>In person</strong><small>You can meet clients in Luxembourg.</small></span></label>
                </div>
              </div>

              <div className={styles.actions}>
                {step === 2 ? <button type="button" className={styles.back} onClick={() => setStep(1)}><ChevronLeft size={15}/> Back</button> : <Link href="/sign-in" className={styles.back}><ChevronLeft size={15}/> Back</Link>}
                {step === 1 ? <button type="button" className={styles.primary} disabled={!canContinue} onClick={() => setStep(2)}>Continue <ArrowRight size={15}/></button> : <button type="submit" className={styles.primary}>Save & choose plan <ArrowRight size={15}/></button>}
              </div>
            </form>
          ) : (
            <div className={styles.stepPanel}>
              <div className={styles.cardHead}><div className={styles.icon}><Sparkles size={21}/></div><div><span>Step 3 of 3</span><h2>Choose your listing plan</h2><p>Both plans include a 30-day trial. Your listing becomes visible only after approval.</p></div></div>
              <div className={styles.plans}>
                <article className={`${styles.plan} ${subscription?.tier === "basic" ? styles.current : ""}`}>
                  <div className={styles.planTop}><div><span>Basic</span><strong>€19<small>/month</small></strong></div>{subscription?.tier === "basic" ? <em>Current</em> : null}</div>
                  <p>A complete professional presence for firms that want to be discoverable inside Zuelen.</p>
                  <ul><li><Check size={14}/>Full professional profile</li><li><Check size={14}/>Languages and specialties</li><li><Check size={14}/>Direct contact details</li><li><Check size={14}/>Standard directory placement</li></ul>
                  <form action={startAccountantTrialAction}><input type="hidden" name="tier" value="basic"/><button disabled={!stripeConfigured || (subscriptionOpen && subscription?.tier === "basic")} type="submit">{subscriptionOpen ? subscription?.tier === "basic" ? "Current plan" : "Change to Basic" : trialUsed ? "Subscribe to Basic" : "Start Basic trial"}</button></form>
                </article>
                <article className={`${styles.plan} ${styles.premium} ${subscription?.tier === "premium" ? styles.current : ""}`}>
                  <div className={styles.planTop}><div><span><Sparkles size={13}/> Premium</span><strong>€29<small>/month</small></strong></div>{subscription?.tier === "premium" ? <em>Current</em> : <em>Recommended</em>}</div>
                  <p>Higher visibility plus analytics for practices that want Zuelen to become a lead channel.</p>
                  <ul><li><Check size={14}/>Everything in Basic</li><li><Check size={14}/>Featured badge</li><li><Check size={14}/>Priority placement</li><li><Check size={14}/>Profile and contact analytics</li></ul>
                  <form action={startAccountantTrialAction}><input type="hidden" name="tier" value="premium"/><button disabled={!stripeConfigured || (subscriptionOpen && subscription?.tier === "premium")} type="submit">{subscriptionOpen ? subscription?.tier === "premium" ? "Current plan" : "Upgrade to Premium" : trialUsed ? "Subscribe to Premium" : "Start Premium trial"}</button></form>
                </article>
              </div>
              {!stripeConfigured ? <div className={styles.qaNote}><ShieldCheck size={16}/><div><strong>Billing is held for UI QA.</strong><p>The live accountant prices are not connected yet, so plan checkout stays disabled until this onboarding experience is approved.</p></div></div> : null}
              <div className={styles.finish}><Link href="/accountants/manage">Open professional workspace <ExternalLink size={14}/></Link><small>You can review or edit your profile before billing is enabled.</small></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
