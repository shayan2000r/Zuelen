import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, Building2, Clock3, ExternalLink, MailCheck, RefreshCw, ShieldCheck, UserRound, UsersRound, X } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspace } from "@/lib/workspace";
import { inviteEarlyAccessAction, rejectEarlyAccessAction } from "./actions";
import styles from "./early-access-admin.module.css";

export const dynamic = "force-dynamic";

type Params = { result?: string };
type WaitlistRow = {
  id: string;
  email: string;
  audience: "independent" | "company" | "accountant";
  locale: "fr" | "en";
  referral_code: string | null;
  source: string;
  status: "waiting" | "approved" | "invited" | "activated" | "rejected";
  created_at: string;
  approved_at: string | null;
  invited_at: string | null;
  activated_at: string | null;
};

const audienceLabel = { independent: "Independent", company: "Company", accountant: "Accountant / Fiduciaire" } as const;
const audienceIcon = { independent: UserRound, company: Building2, accountant: BriefcaseBusiness } as const;
const statusRank: Record<WaitlistRow["status"], number> = { waiting: 0, approved: 1, invited: 2, activated: 3, rejected: 4 };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-LU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function EarlyAccessAdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in?next=/admin/early-access");
  const params = await searchParams;
  const admin = createAdminClient();

  const { data: reviewer, error: reviewerError } = await admin
    .from("early_access_reviewers")
    .select("user_id")
    .eq("user_id", workspace.userId)
    .maybeSingle();
  if (reviewerError) throw new Error(reviewerError.message);
  if (!reviewer) notFound();

  const { data, error } = await admin
    .from("early_access_waitlist")
    .select("id,email,audience,locale,referral_code,source,status,created_at,approved_at,invited_at,activated_at")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(error.message);

  const requests = (data ?? []) as WaitlistRow[];
  const ordered = [...requests].sort((a, b) => statusRank[a.status] - statusRank[b.status] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const counts = {
    waiting: requests.filter(item => item.status === "waiting").length,
    invited: requests.filter(item => item.status === "invited").length,
    activated: requests.filter(item => item.status === "activated").length,
    total: requests.length,
  };

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <Link href="/admin/early-access" className={styles.brand}><img src="/zuelen-icon.png" alt=""/><strong>Zuelen</strong><span>Early Access</span></Link>
      <div className={styles.links}><Link href="/admin/accountants">Accountant reviews</Link><span><ShieldCheck size={14}/> Internal reviewer workspace</span></div>
    </header>

    <div className={styles.page}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}><UsersRound size={14}/> Controlled rollout</span><h1>Manage the Zuelen access list.</h1><p>Review requests, send personal invitations and track activation without opening public account creation.</p></div>
        <div className={styles.metrics}>
          <article><span>Waiting</span><strong>{counts.waiting}</strong></article>
          <article><span>Invited</span><strong>{counts.invited}</strong></article>
          <article><span>Activated</span><strong>{counts.activated}</strong></article>
          <article><span>Total</span><strong>{counts.total}</strong></article>
        </div>
      </section>

      {params.result === "invited" ? <div className={styles.notice}><MailCheck size={15}/> Invitation sent successfully.</div> : null}
      {params.result === "rejected" ? <div className={styles.notice}><X size={15}/> Request moved out of the active rollout queue.</div> : null}
      {params.result === "already-active" ? <div className={styles.notice}><BadgeCheck size={15}/> This user is already activated.</div> : null}

      <section className={styles.list}>
        {ordered.length ? ordered.map(item => {
          const Icon = audienceIcon[item.audience];
          const canInvite = item.status !== "activated" && item.status !== "rejected";
          const cardClass = styles.card + (item.status === "waiting" ? " " + styles.waitingCard : "");
          const statusClass = styles.status + " " + styles[item.status];
          return <article className={cardClass} key={item.id}>
            <div className={styles.identity}>
              <span className={styles.audienceIcon}><Icon size={18}/></span>
              <div><div className={styles.emailLine}><h2>{item.email}</h2><span className={statusClass}>{item.status}</span></div><p>{audienceLabel[item.audience]} · {item.locale.toUpperCase()} · Joined {formatDate(item.created_at)}</p></div>
            </div>

            <div className={styles.meta}>
              <div><span>Referral / invitation</span><strong>{item.referral_code || "—"}</strong></div>
              <div><span>Approved</span><strong>{formatDate(item.approved_at)}</strong></div>
              <div><span>Invited</span><strong>{formatDate(item.invited_at)}</strong></div>
              <div><span>Activated</span><strong>{formatDate(item.activated_at)}</strong></div>
            </div>

            <div className={styles.actions}>
              {canInvite ? <form action={inviteEarlyAccessAction}><input type="hidden" name="id" value={item.id}/><button className={styles.invite} type="submit">{item.status === "invited" ? <RefreshCw size={14}/> : <MailCheck size={14}/>} {item.status === "invited" ? "Resend invitation" : "Approve & invite"}</button></form> : <span className={styles.complete}><BadgeCheck size={14}/> Access active</span>}
              {item.status !== "activated" && item.status !== "rejected" ? <form action={rejectEarlyAccessAction}><input type="hidden" name="id" value={item.id}/><button className={styles.reject} type="submit"><X size={14}/> Remove from queue</button></form> : null}
              <a href={item.locale === "fr" ? "https://zuelen.lu/acces-anticipe" : "https://zuelen.lu/en/early-access"} target="_blank" rel="noreferrer">View access page <ExternalLink size={12}/></a>
            </div>
          </article>;
        }) : <div className={styles.empty}><Clock3 size={24}/><strong>No early-access requests yet</strong><p>New website requests will appear here automatically.</p></div>}
      </section>
    </div>
  </main>;
}
