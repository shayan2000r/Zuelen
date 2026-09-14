import Link from "next/link";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, Building2, Clock3, CreditCard, Mail, ShieldCheck, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { requireZuelenAdmin } from "@/lib/admin";
import { getAdminUserDetail } from "@/lib/admin-data";
import styles from "./user-detail.module.css";

export const dynamic = "force-dynamic";

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-LU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { admin } = await requireZuelenAdmin("/admin/users/" + userId);
  const detail = await getAdminUserDetail(admin, userId);
  if (!detail) notFound();

  const accountState = detail.user.emailConfirmedAt || detail.user.lastSignInAt ? "Active" : "Invite pending";

  return <main className={styles.shell}>
    <div className={styles.page}>
      <Link className={styles.back} href="/admin/users"><ArrowLeft size={13}/>Back to users</Link>

      <section className={styles.hero}>
        <div>
          <span>Account inspector</span>
          <h1>{detail.profile?.full_name || detail.user.email}</h1>
          <p>Read-only administrative view of this Zuelen identity and the workspaces connected to it.</p>
        </div>
        <div className={styles.state}><ShieldCheck size={16}/><div><strong>{accountState}</strong><span>{detail.user.email}</span></div></div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2><UserRound size={16}/>Identity</h2>
          <dl>
            <div><dt>Email</dt><dd>{detail.user.email}</dd></div>
            <div><dt>Email confirmed</dt><dd>{date(detail.user.emailConfirmedAt)}</dd></div>
            <div><dt>Created</dt><dd>{date(detail.user.createdAt)}</dd></div>
            <div><dt>Last sign-in</dt><dd>{date(detail.user.lastSignInAt)}</dd></div>
            <div><dt>Locale</dt><dd>{detail.profile?.locale || "—"}</dd></div>
          </dl>
        </article>

        <article className={styles.card}>
          <h2><Clock3 size={16}/>Early Access</h2>
          {detail.waitlist ? <dl>
            <div><dt>Status</dt><dd><span className={styles.badge}>{detail.waitlist.status}</span></dd></div>
            <div><dt>Audience</dt><dd>{detail.waitlist.audience}</dd></div>
            <div><dt>Requested</dt><dd>{date(detail.waitlist.created_at)}</dd></div>
            <div><dt>Invited</dt><dd>{date(detail.waitlist.invited_at)}</dd></div>
            <div><dt>Activated</dt><dd>{date(detail.waitlist.activated_at)}</dd></div>
          </dl> : <p className={styles.empty}>No waitlist record for this identity.</p>}
        </article>
      </section>

      <section className={styles.section}>
        <header><div><span>Business access</span><h2>Organizations & workspaces</h2></div><Building2 size={20}/></header>
        {detail.organizations.length ? <div className={styles.workspaceGrid}>{detail.organizations.map(org => {
          const membership = detail.memberships.find(item => item.organization_id === org.id);
          const company = detail.companies.find(item => item.organization_id === org.id);
          const subscription = detail.subscriptions.find(item => item.organization_id === org.id);
          return <article key={org.id}>
            <div className={styles.workspaceHead}><strong>{company?.trading_name || company?.legal_name || org.name}</strong><span>{company?.entity_kind || "workspace"}</span></div>
            <dl>
              <div><dt>Organization</dt><dd>{org.name}</dd></div>
              <div><dt>Role</dt><dd>{membership?.role || "—"}</dd></div>
              <div><dt>Legal form</dt><dd>{company?.legal_form || "—"}</dd></div>
              <div><dt>Plan</dt><dd>{subscription ? subscription.plan + " · " + subscription.status : "No subscription"}</dd></div>
              <div><dt>VAT</dt><dd>{company?.vat_registered ? "Registered" : "Not registered"}</dd></div>
            </dl>
          </article>;
        })}</div> : <p className={styles.empty}>No business workspace connected yet.</p>}
      </section>

      {detail.accountant ? <section className={styles.section}>
        <header><div><span>Professional profile</span><h2>Accountant directory</h2></div><BriefcaseBusiness size={20}/></header>
        <article className={styles.accountant}>
          <div><strong>{detail.accountant.full_name}</strong><span>{detail.accountant.firm_name || "Independent professional"}</span></div>
          <div className={styles.accountantMeta}><span><BadgeCheck size={13}/>{detail.accountant.approval_status}</span><span><CreditCard size={13}/>{detail.accountantSubscription ? detail.accountantSubscription.tier + " · " + detail.accountantSubscription.status : "No listing subscription"}</span></div>
        </article>
      </section> : null}

      <div className={styles.note}><Mail size={15}/><p>This inspector intentionally does not impersonate the user or alter their session. Administrative visibility uses the server-only service role while the customer account remains isolated.</p></div>
    </div>
  </main>;
}
