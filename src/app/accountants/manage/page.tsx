import Link from "next/link";
import { ArrowLeft, BadgeCheck, BarChart3, BriefcaseBusiness, Check, Clock3, ExternalLink, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { ACCOUNTANT_BUSINESS_TYPES, ACCOUNTANT_LANGUAGES, ACCOUNTANT_SPECIALTIES, accountantInitials, accountantStripeConfigured, type AccountantListingSubscription, type AccountantProfile } from "@/lib/accountants";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { createAccountantPortalAction, saveAccountantProfileAction, startAccountantTrialAction } from "./actions";
import styles from "./manage.module.css";

export const dynamic = "force-dynamic";

function daysLeft(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}

export default async function AccountantManagePage({ searchParams }: { searchParams: Promise<{ saved?: string; checkout?: string }> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in?next=/accountants/manage");
  const params = await searchParams;
  const supabase = await createClient();
  const { data: profileData, error: profileError } = await supabase.from("accountant_profiles").select("*").eq("user_id", workspace.userId).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  const profile = profileData as AccountantProfile | null;
  let subscription: AccountantListingSubscription | null = null;
  let analytics = { view: 0, email: 0, phone: 0, website: 0 };
  if (profile) {
    const { data, error } = await supabase.from("accountant_listing_subscriptions").select("*").eq("profile_id", profile.id).maybeSingle();
    if (error) throw new Error(error.message);
    subscription = data as AccountantListingSubscription | null;
    if (subscription?.tier === "premium" && ["active", "trialing"].includes(subscription.status)) {
      const { data: events, error: eventsError } = await supabase.from("accountant_profile_events").select("event_type").eq("profile_id", profile.id);
      if (eventsError) throw new Error(eventsError.message);
      for (const event of events ?? []) {
        const key = event.event_type as keyof typeof analytics;
        if (key in analytics) analytics[key] += 1;
      }
    }
  }
  const configured = accountantStripeConfigured();
  const trialDays = daysLeft(subscription?.trial_end ?? null);
  const live = profile?.approval_status === "approved" && Boolean(subscription && ["active", "trialing"].includes(subscription.status));

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <Link href={workspace.company ? "/app/accountants" : "/"} className={styles.brand}><img src="/zuelen-icon.png" alt="" /><strong>Zuelen</strong><span>Professionals</span></Link>
      <Link href={workspace.company ? "/app/accountants" : "/sign-in"} className={styles.back}><ArrowLeft size={14}/>{workspace.company ? "Back to directory" : "Back"}</Link>
    </header>

    <div className={styles.page}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}><BriefcaseBusiness size={14}/> Zuelen for accountants</span><h1>Your practice, in front of businesses that need you.</h1><p>Create a trusted professional profile, start your 30-day trial, and appear in Zuelen once your listing is approved.</p></div>
        {profile ? <div className={styles.statusCard}><span>Listing status</span><strong className={styles[profile.approval_status]}>{profile.approval_status === "approved" ? <BadgeCheck size={16}/> : <Clock3 size={16}/>} {profile.approval_status}</strong><small>{live ? "Visible in the directory" : profile.approval_status === "pending" ? "Waiting for Zuelen review" : profile.approval_status === "rejected" ? profile.rejection_reason || "Changes are required" : "Subscription required"}</small></div> : null}
      </section>

      {params.saved ? <div className={styles.notice}><Check size={15}/> Profile saved. Material changes are reviewed before they appear publicly.</div> : null}
      {params.checkout === "success" ? <div className={styles.notice}><Check size={15}/> Subscription received. Stripe may take a few seconds to sync your 30-day trial.</div> : null}

      <section className={styles.grid}>
        <form action={saveAccountantProfileAction} encType="multipart/form-data" className={styles.formCard}>
          <div className={styles.sectionHead}><div><span>Professional profile</span><h2>{profile ? "Edit your listing" : "Create your listing"}</h2></div>{profile?.photo_url ? <img src={profile.photo_url} alt="" className={styles.avatar}/> : <span className={styles.avatarFallback}>{accountantInitials(profile?.full_name || workspace.profile?.full_name || workspace.email || "A")}</span>}</div>
          <div className={styles.twoCols}>
            <label><span>Full name *</span><input name="full_name" required defaultValue={profile?.full_name ?? workspace.profile?.full_name ?? ""} placeholder="Marie Dupont"/></label>
            <label><span>Firm / practice</span><input name="firm_name" defaultValue={profile?.firm_name ?? ""} placeholder="Dupont Fiduciaire"/></label>
            <label><span>Professional title *</span><input name="professional_title" required defaultValue={profile?.professional_title ?? "Accountant"} placeholder="Accountant / Expert-comptable"/></label>
            <label><span>Location</span><input name="location" defaultValue={profile?.location ?? "Luxembourg"} placeholder="Luxembourg City"/></label>
            <label><span>Contact email *</span><input name="email" type="email" required defaultValue={profile?.email ?? workspace.email ?? ""}/></label>
            <label><span>Phone</span><input name="phone" defaultValue={profile?.phone ?? ""} placeholder="+352 ..."/></label>
            <label><span>Website</span><input name="website" defaultValue={profile?.website ?? ""} placeholder="yourfirm.lu"/></label>
            <label><span>Profile photo</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPG, PNG or WebP · max 5 MB</small></label>
          </div>
          <label><span>About your practice</span><textarea name="bio" rows={5} defaultValue={profile?.bio ?? ""} placeholder="Explain who you help, your experience and how you work with clients."/></label>

          <fieldset><legend>Languages</legend><div className={styles.chips}>{ACCOUNTANT_LANGUAGES.map(value => <label className={styles.checkChip} key={value}><input type="checkbox" name="languages" value={value} defaultChecked={profile?.languages.includes(value)}/><span>{value}</span></label>)}</div></fieldset>
          <fieldset><legend>Specialties</legend><div className={styles.chips}>{ACCOUNTANT_SPECIALTIES.map(value => <label className={styles.checkChip} key={value}><input type="checkbox" name="specialties" value={value} defaultChecked={profile?.specialties.includes(value)}/><span>{value}</span></label>)}</div></fieldset>
          <fieldset><legend>Businesses you work with</legend><div className={styles.chips}>{ACCOUNTANT_BUSINESS_TYPES.map(value => <label className={styles.checkChip} key={value}><input type="checkbox" name="business_types" value={value} defaultChecked={profile?.business_types.includes(value)}/><span>{value}</span></label>)}</div></fieldset>
          <div className={styles.toggles}>
            <label><input type="checkbox" name="accepting_new_clients" defaultChecked={profile?.accepting_new_clients ?? true}/><span><strong>Accepting new clients</strong><small>Show businesses that you are open to enquiries.</small></span></label>
            <label><input type="checkbox" name="works_remotely" defaultChecked={profile?.works_remotely ?? true}/><span><strong>Remote</strong><small>You can work with clients remotely.</small></span></label>
            <label><input type="checkbox" name="works_in_person" defaultChecked={profile?.works_in_person ?? true}/><span><strong>In person</strong><small>You meet clients in Luxembourg.</small></span></label>
          </div>
          <button className={styles.primary} type="submit">{profile ? "Save profile" : "Create profile"}</button>
          <p className={styles.reviewNote}><ShieldCheck size={14}/> New listings and material profile changes are reviewed by Zuelen before publication.</p>
        </form>

        <aside className={styles.side}>
          <div className={styles.planCard}>
            <div className={styles.sectionHead}><div><span>Directory subscription</span><h2>{subscription ? `${subscription.tier === "premium" ? "Premium" : "Basic"} listing` : "Choose your plan"}</h2></div>{subscription?.tier === "premium" ? <Sparkles size={20}/> : null}</div>
            {subscription ? <div className={styles.subscriptionSummary}><div><span>Status</span><strong>{subscription.status}</strong></div>{trialDays !== null ? <div><span>Trial</span><strong>{trialDays} day{trialDays === 1 ? "" : "s"} left</strong></div> : null}{subscription.current_period_end ? <div><span>Next billing date</span><strong>{new Date(subscription.current_period_end).toLocaleDateString("en-GB")}</strong></div> : null}</div> : null}
            {subscription?.stripe_customer_id ? <form action={createAccountantPortalAction}><button className={styles.secondary} type="submit">Manage billing <ExternalLink size={14}/></button></form> : null}
          </div>

          <div className={`${styles.priceCard} ${subscription?.tier === "basic" ? styles.selected : ""}`}><div><span>Basic</span><strong>€19<small>/month</small></strong></div><p>A complete professional listing with direct contact details and standard directory placement.</p><ul><li><Check size={14}/>Full professional profile</li><li><Check size={14}/>Languages & specialties</li><li><Check size={14}/>Direct email, phone & website</li><li><Check size={14}/>30-day free trial</li></ul><form action={startAccountantTrialAction}><input type="hidden" name="tier" value="basic"/><button disabled={!profile || !configured || Boolean(subscription && ["active","trialing","past_due"].includes(subscription.status))} className={styles.secondary} type="submit">{subscription?.tier === "basic" ? "Current plan" : "Start Basic trial"}</button></form></div>

          <div className={`${styles.priceCard} ${styles.premiumCard} ${subscription?.tier === "premium" ? styles.selected : ""}`}><div><span><Sparkles size={14}/> Premium</span><strong>€29<small>/month</small></strong></div><p>Maximum visibility plus enhanced presentation and measurable lead analytics.</p><ul><li><Check size={14}/>Everything in Basic</li><li><Check size={14}/>Featured badge</li><li><Check size={14}/>Priority placement</li><li><Check size={14}/>Profile & contact analytics</li><li><Check size={14}/>30-day free trial</li></ul><form action={startAccountantTrialAction}><input type="hidden" name="tier" value="premium"/><button disabled={!profile || !configured || Boolean(subscription && ["active","trialing","past_due"].includes(subscription.status))} className={styles.primary} type="submit">{subscription?.tier === "premium" ? "Current plan" : "Start Premium trial"}</button></form></div>
          {!configured ? <p className={styles.configNote}>Stripe checkout is intentionally disabled until the two accountant listing prices are created after UI QA.</p> : null}

          <div className={styles.analyticsCard}><div className={styles.sectionHead}><div><span>Performance</span><h2>Listing analytics</h2></div><BarChart3 size={19}/></div>{subscription?.tier === "premium" && ["active","trialing"].includes(subscription.status) ? <div className={styles.analytics}><div><strong>{analytics.view}</strong><span>Profile views</span></div><div><strong>{analytics.email + analytics.phone}</strong><span>Contact clicks</span></div><div><strong>{analytics.website}</strong><span>Website clicks</span></div></div> : <div className={styles.lockedAnalytics}><Sparkles size={18}/><strong>Premium analytics</strong><p>See profile views and the actions businesses take from your listing.</p></div>}</div>
        </aside>
      </section>

      <footer className={styles.footer}><div><Mail size={15}/><span>Questions about professional listings? <strong>contact@zuelen.lu</strong></span></div><p>Professionals listed on Zuelen operate independently. A listing does not make the professional an employee or agent of Zuelen.</p></footer>
    </div>
  </main>;
}