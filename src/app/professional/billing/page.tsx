import { Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { ProfessionalFrame } from "@/components/professional-frame";
import { accountantStripeConfigured } from "@/lib/accountants";
import { ACTIVE_ACCOUNTANT_SUBSCRIPTION_STATUSES, accountantSubscriptionStatusLabel, accountantTrialDaysLeft, getProfessionalWorkspace } from "@/lib/professional-workspace";
import { createAccountantPortalAction, startAccountantTrialAction } from "@/app/accountants/manage/actions";
import styles from "../professional.module.css";

export const dynamic = "force-dynamic";

export default async function ProfessionalBillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string }> }) {
  const { workspace, profile, subscription } = await getProfessionalWorkspace(true);
  const params = await searchParams;
  if (!profile) return null;

  const configured = accountantStripeConfigured();
  const subscriptionOpen = Boolean(subscription && ACTIVE_ACCOUNTANT_SUBSCRIPTION_STATUSES.has(subscription.status));
  const trialUsed = Boolean(subscription?.trial_end);
  const trialDays = accountantTrialDaysLeft(subscription?.trial_end);
  const basicLabel = subscriptionOpen
    ? subscription?.tier === "basic" ? "Current plan" : "Change to Basic"
    : trialUsed ? "Subscribe to Basic" : "Start Basic trial";
  const premiumLabel = subscriptionOpen
    ? subscription?.tier === "premium" ? "Current plan" : "Upgrade to Premium"
    : trialUsed ? "Subscribe to Premium" : "Start Premium trial";

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
      <div className={styles.pageHead}><div><span>Account & billing</span><h1>Subscription & billing</h1><p>Manage your directory plan, free trial and payment details without mixing billing controls into your profile editor.</p></div></div>

      {params.checkout === "cancelled" ? <div className={`${styles.notice} ${styles.warning}`}>Checkout was cancelled. No subscription changes were made.</div> : null}
      {params.plan === "basic" || params.plan === "premium" ? <div className={styles.notice}><Check size={15}/> Plan change sent to Stripe. Your listing will update as soon as the subscription sync completes.</div> : null}

      <div className={styles.billingGrid}>
        <section className={`${styles.card} ${styles.billingSummary}`}>
          <div className={styles.sectionHead}><div><span>Current subscription</span><h2>{subscription ? `${subscription.tier === "premium" ? "Premium" : "Basic"} listing` : "No active plan"}</h2></div><CreditCard size={19}/></div>
          <dl>
            <div><dt>Status</dt><dd>{accountantSubscriptionStatusLabel(subscription?.status)}</dd></div>
            {subscription?.status === "trialing" && trialDays !== null ? <div><dt>Free trial</dt><dd>{trialDays} day{trialDays === 1 ? "" : "s"} left</dd></div> : null}
            {subscription?.current_period_end ? <div><dt>Next billing date</dt><dd>{new Date(subscription.current_period_end).toLocaleDateString("en-GB")}</dd></div> : null}
            {subscription ? <div><dt>Price</dt><dd>{subscription.tier === "premium" ? "€29/month" : "€19/month"}</dd></div> : null}
          </dl>
          {subscription?.stripe_customer_id ? <form action={createAccountantPortalAction} style={{marginTop:16}}><button className={styles.secondary} type="submit">Manage payment details <ExternalLink size={14}/></button></form> : null}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}><div><span>Directory plans</span><h2>Choose your visibility</h2></div></div>
          <div className={styles.plans}>
            <article className={`${styles.plan} ${subscription?.tier === "basic" ? styles.current : ""}`}>
              <div className={styles.planTop}><span>Basic</span><strong>€19<small>/month</small></strong></div>
              {subscription?.tier === "basic" ? <em className={styles.currentBadge}>Current plan</em> : null}
              <p>A complete professional listing with direct contact details and standard directory placement.</p>
              <ul><li><Check size={14}/>Full professional profile</li><li><Check size={14}/>Languages & specialties</li><li><Check size={14}/>Direct contact details</li><li><Check size={14}/>30-day free trial for new listings</li></ul>
              <form action={startAccountantTrialAction}><input type="hidden" name="tier" value="basic"/><button disabled={!configured || (subscriptionOpen && subscription?.tier === "basic")} className={styles.secondary} type="submit">{basicLabel}</button></form>
            </article>

            <article className={`${styles.plan} ${styles.premium} ${subscription?.tier === "premium" ? styles.current : ""}`}>
              <div className={styles.planTop}><span><Sparkles size={13}/> Premium</span><strong>€29<small>/month</small></strong></div>
              {subscription?.tier === "premium" ? <em className={styles.currentBadge}>Current plan</em> : null}
              <p>Maximum visibility plus enhanced presentation and measurable lead analytics.</p>
              <ul><li><Check size={14}/>Everything in Basic</li><li><Check size={14}/>Featured badge</li><li><Check size={14}/>Priority placement</li><li><Check size={14}/>Profile & contact analytics</li></ul>
              <form action={startAccountantTrialAction}><input type="hidden" name="tier" value="premium"/><button disabled={!configured || (subscriptionOpen && subscription?.tier === "premium")} className={styles.primary} type="submit">{premiumLabel}</button></form>
            </article>
          </div>
          {!configured ? <p style={{fontSize:9,color:"#777",marginTop:12}}>Stripe checkout is temporarily unavailable because billing configuration is incomplete.</p> : null}
        </section>
      </div>
    </div>
  </ProfessionalFrame>;
}
