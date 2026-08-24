import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, Check, Clock3, ExternalLink, Languages, MapPin, ShieldCheck, Sparkles, UserRoundCheck, X } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { accountantInitials, accountantLanguageLabel, type AccountantListingSubscription, type AccountantProfile } from "@/lib/accountants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspace } from "@/lib/workspace";
import { reviewAccountantProfileAction } from "./actions";
import styles from "./review.module.css";

export const dynamic = "force-dynamic";

type Params = { reviewed?: string };

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function AccountantReviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in?next=/admin/accountants");
  const params = await searchParams;
  const admin = createAdminClient();

  const { data: reviewer, error: reviewerError } = await admin
    .from("accountant_reviewers")
    .select("user_id")
    .eq("user_id", workspace.userId)
    .maybeSingle();
  if (reviewerError) throw new Error(reviewerError.message);
  if (!reviewer) notFound();

  const { data: profileRows, error: profileError } = await admin
    .from("accountant_profiles")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (profileError) throw new Error(profileError.message);
  const profiles = (profileRows ?? []) as AccountantProfile[];

  const profileIds = profiles.map(profile => profile.id);
  let subscriptions: AccountantListingSubscription[] = [];
  if (profileIds.length) {
    const { data, error } = await admin
      .from("accountant_listing_subscriptions")
      .select("*")
      .in("profile_id", profileIds);
    if (error) throw new Error(error.message);
    subscriptions = (data ?? []) as AccountantListingSubscription[];
  }
  const subscriptionByProfile = new Map(subscriptions.map(subscription => [subscription.profile_id, subscription]));
  const statusRank: Record<AccountantProfile["approval_status"], number> = { pending: 0, rejected: 1, approved: 2 };
  const orderedProfiles = [...profiles].sort((a, b) => statusRank[a.approval_status] - statusRank[b.approval_status] || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const pendingCount = profiles.filter(profile => profile.approval_status === "pending").length;

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}><img src="/zuelen-icon.png" alt=""/><strong>Zuelen</strong><span>Review</span></Link>
      <div className={styles.reviewer}><ShieldCheck size={14}/> Internal reviewer workspace</div>
    </header>

    <div className={styles.page}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}><UserRoundCheck size={14}/> Accountant directory moderation</span><h1>Review professional listings.</h1><p>Approve only profiles whose identity, positioning and public information are suitable for the Zuelen directory. Billing eligibility is handled separately by Stripe.</p></div>
        <div className={styles.queue}><span>Review queue</span><strong>{pendingCount}</strong><small>profile{pendingCount === 1 ? "" : "s"} awaiting review</small></div>
      </section>

      {params.reviewed === "approved" ? <div className={styles.notice}><Check size={15}/> Profile approved. It becomes public automatically when its listing subscription is eligible.</div> : null}
      {params.reviewed === "rejected" ? <div className={styles.notice}><X size={15}/> Profile sent back for changes with your review note.</div> : null}

      <section className={styles.list}>
        {orderedProfiles.length ? orderedProfiles.map(profile => {
          const subscription = subscriptionByProfile.get(profile.id) ?? null;
          const isPremium = subscription?.tier === "premium";
          return <article className={`${styles.card} ${profile.approval_status === "pending" ? styles.needsReview : ""}`} key={profile.id}>
            <div className={styles.cardTop}>
              <div className={styles.identity}>
                {profile.photo_url ? <img src={profile.photo_url} alt=""/> : <span>{accountantInitials(profile.full_name)}</span>}
                <div><div className={styles.nameLine}><h2>{profile.full_name}</h2>{isPremium ? <Sparkles size={14}/> : null}</div><p>{profile.professional_title}{profile.firm_name ? ` · ${profile.firm_name}` : ""}</p><div className={styles.meta}>{profile.location ? <span><MapPin size={12}/>{profile.location}</span> : null}{profile.years_experience !== null ? <span><BriefcaseBusiness size={12}/>{profile.years_experience} years</span> : null}</div></div>
              </div>
              <div className={styles.statuses}>
                <span className={styles[profile.approval_status]}>{profile.approval_status === "approved" ? <BadgeCheck size={13}/> : <Clock3 size={13}/>} {profile.approval_status}</span>
                <span>{subscription ? `${subscription.tier} · ${subscription.status}` : "No listing subscription"}</span>
                {subscription?.trial_end ? <small>Trial ends {formatDate(subscription.trial_end)}</small> : null}
              </div>
            </div>

            <div className={styles.details}>
              <div><span>Contact</span><p>{profile.email || "—"}{profile.phone ? <><br/>{profile.phone}</> : null}</p>{profile.website ? <a href={profile.website} target="_blank" rel="noreferrer">Website <ExternalLink size={11}/></a> : null}{profile.portfolio_url ? <a href={profile.portfolio_url} target="_blank" rel="noreferrer">Professional profile <ExternalLink size={11}/></a> : null}</div>
              <div><span>Languages</span><p className={styles.tags}>{profile.languages.length ? profile.languages.map(item => <em key={item}>{accountantLanguageLabel(item, "en", true)}</em>) : "—"}</p></div>
              <div><span>Specialties</span><p className={styles.tags}>{profile.specialties.length ? profile.specialties.map(item => <em key={item}>{item}</em>) : "—"}</p></div>
              <div><span>Businesses</span><p className={styles.tags}>{profile.business_types.length ? profile.business_types.map(item => <em key={item}>{item}</em>) : "—"}</p></div>
            </div>

            <div className={styles.narrative}>
              <div><span>About</span><p>{profile.bio || "No biography provided."}</p></div>
              <div><span>Qualifications</span><p>{profile.qualifications || "No qualifications provided."}</p></div>
              <div><span>Client references</span><p>{profile.client_references || "No client references provided."}</p></div>
            </div>

            {profile.rejection_reason ? <div className={styles.previousReason}><strong>Current review note</strong><p>{profile.rejection_reason}</p></div> : null}

            <div className={styles.actions}>
              <form action={reviewAccountantProfileAction}>
                <input type="hidden" name="profile_id" value={profile.id}/><input type="hidden" name="decision" value="approved"/>
                <button className={styles.approve} type="submit" disabled={profile.approval_status === "approved"}><Check size={14}/>{profile.approval_status === "approved" ? "Approved" : "Approve profile"}</button>
              </form>
              <form action={reviewAccountantProfileAction} className={styles.rejectForm}>
                <input type="hidden" name="profile_id" value={profile.id}/><input type="hidden" name="decision" value="rejected"/>
                <input name="rejection_reason" minLength={5} required placeholder="Reason for rejection / requested change" defaultValue={profile.approval_status === "rejected" ? profile.rejection_reason ?? "" : ""}/>
                <button className={styles.reject} type="submit"><X size={14}/>Request changes</button>
              </form>
            </div>
          </article>;
        }) : <div className={styles.empty}><Languages size={22}/><strong>No accountant profiles yet</strong><p>New professional applications will appear here automatically.</p></div>}
      </section>
    </div>
  </main>;
}
