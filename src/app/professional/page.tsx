import Link from "next/link";
import { BadgeCheck, BarChart3, Check, Clock3, ExternalLink, Sparkles, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AccountantOnboarding } from "@/components/accountant-onboarding";
import { ProfessionalFrame } from "@/components/professional-frame";
import { accountantInitials, accountantStripeConfigured } from "@/lib/accountants";
import { accountantApprovalStatusLabel, accountantSubscriptionStatusLabel, accountantTrialDaysLeft, DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES, getProfessionalWorkspace } from "@/lib/professional-workspace";
import styles from "./professional.module.css";

export const dynamic = "force-dynamic";

type Params = { step?: string; checkout?: string };

export default async function ProfessionalPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { workspace, supabase, profile, subscription } = await getProfessionalWorkspace(false);

  if (!profile) {
    return <AccountantOnboarding
      email={workspace.email}
      profile={null}
      subscription={null}
      stripeConfigured={accountantStripeConfigured()}
      initialStep={1}
      checkoutStatus={params.checkout ?? null}
    />;
  }

  if (params.step === "3" && !subscription) {
    return <AccountantOnboarding
      email={workspace.email}
      profile={profile}
      subscription={null}
      stripeConfigured={accountantStripeConfigured()}
      initialStep={3}
      checkoutStatus={params.checkout ?? null}
    />;
  }

  if (!subscription && params.checkout !== "success") redirect("/professional?step=3");

  const analytics = { view: 0, email: 0, phone: 0, website: 0 };
  if (subscription?.tier === "premium" && DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES.has(subscription.status)) {
    const { data: events, error } = await supabase.from("accountant_profile_events").select("event_type").eq("profile_id", profile.id);
    if (error) throw new Error(error.message);
    for (const event of events ?? []) {
      const key = event.event_type as keyof typeof analytics;
      if (key in analytics) analytics[key] += 1;
    }
  }

  const trialDays = accountantTrialDaysLeft(subscription?.trial_end);
  const live = profile.approval_status === "approved" && Boolean(subscription && DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES.has(subscription.status));
  const firstName = profile.full_name.split(/\s+/).filter(Boolean)[0] || "there";

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
        <div><span>Zuelen for accountants</span><h1>Good to see you, {firstName}.</h1><p>Your professional workspace keeps your listing, subscription and performance separated into focused areas.</p></div>
        <Link href="/accountants/directory" className={styles.secondaryLink}>View directory <ExternalLink size={14}/></Link>
      </div>

      {params.checkout === "success" ? <div className={styles.notice}><Check size={15}/> Subscription received. Your billing status will update automatically as Stripe finishes syncing.</div> : null}

      <section className={styles.metrics}>
        <div className={styles.metric}><span>Listing status</span><strong className={profile.approval_status === "approved" ? styles.approvedValue : styles.statusValue}>{profile.approval_status === "approved" ? <BadgeCheck size={17}/> : <Clock3 size={17}/>} {accountantApprovalStatusLabel(profile.approval_status)}</strong><small>{live ? "Visible in the directory" : profile.approval_status === "pending" ? "Waiting for Zuelen review" : "Not currently public"}</small></div>
        <div className={styles.metric}><span>Directory plan</span><strong>{subscription ? (subscription.tier === "premium" ? "Premium" : "Basic") : "Syncing"}</strong><small>{subscription ? "Manage from Subscription & billing" : "Stripe is finishing setup"}</small></div>
        <div className={styles.metric}><span>Billing status</span><strong>{accountantSubscriptionStatusLabel(subscription?.status)}</strong><small>{subscription?.status === "trialing" && trialDays !== null ? `${trialDays} day${trialDays === 1 ? "" : "s"} remaining in your free trial` : subscription?.current_period_end ? `Next billing ${new Date(subscription.current_period_end).toLocaleDateString("en-GB")}` : "No billing action required"}</small></div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.sectionHead}><div><span>Your listing</span><h2>Professional profile</h2></div><UserRound size={19}/></div>
          <div className={styles.profileSummary}>
            {profile.photo_url ? <img src={profile.photo_url} alt=""/> : <span className={styles.profileAvatar}>{accountantInitials(profile.full_name)}</span>}
            <div><h3>{profile.full_name}</h3><p>{profile.professional_title}{profile.firm_name ? ` · ${profile.firm_name}` : ""}</p><small>{profile.location || "Luxembourg"} · {profile.languages.slice(0,3).join(" · ")}</small></div>
          </div>
          <div className={styles.chips}>{profile.specialties.slice(0,5).map(item => <span key={item}>{item}</span>)}</div>
          <div className={styles.cardActions}><Link href="/professional/profile" className={styles.primaryLink}>Edit profile</Link><Link href="/accountants/directory" className={styles.secondaryLink}>Browse directory</Link></div>
        </article>

        <article className={`${styles.card} ${styles.nextStep}`}>
          <div><span className={styles.nextIcon}>{profile.approval_status === "approved" ? <BadgeCheck size={18}/> : <Clock3 size={18}/>}</span><h3>{profile.approval_status === "approved" ? "Your listing is approved" : profile.approval_status === "pending" ? "Review in progress" : "Your listing needs attention"}</h3><p>{profile.approval_status === "approved" ? (live ? "Businesses can discover your profile in the Zuelen directory." : "Your profile is approved. An eligible subscription is required for directory visibility.") : profile.approval_status === "pending" ? "No action is required right now. Zuelen will review the profile before it becomes public." : profile.rejection_reason || "Review your profile details and make the requested changes."}</p></div>
          <Link href="/professional/profile" className={styles.secondaryLink}>{profile.approval_status === "pending" ? "Review my details" : "Open my profile"}</Link>
        </article>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span>Performance</span><h2>Listing analytics</h2></div><BarChart3 size={19}/></div>
        {subscription?.tier === "premium" && DIRECTORY_VISIBLE_ACCOUNTANT_STATUSES.has(subscription.status) ? <div className={styles.analyticsGrid}><div><strong>{analytics.view}</strong><span>Profile views</span></div><div><strong>{analytics.email + analytics.phone}</strong><span>Contact clicks</span></div><div><strong>{analytics.website}</strong><span>Website clicks</span></div></div> : <div className={styles.locked}><Sparkles size={18}/><div><strong>Analytics are included with Premium.</strong><p>Upgrade whenever you want to measure profile views and the actions businesses take from your listing.</p></div><Link href="/professional/billing" className={styles.secondaryLink}>See Premium</Link></div>}
      </section>
    </div>
  </ProfessionalFrame>;
}
