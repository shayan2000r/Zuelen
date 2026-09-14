import Link from "next/link";
import {
  ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Clock3,
  CreditCard, UserRound, UsersRound, UserRoundCheck,
  WalletCards, XCircle,
} from "lucide-react";
import { requireZuelenAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-data";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-LU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

const audienceLabel = {
  independent: "Independent",
  company: "Company",
  accountant: "Accountant",
} as const;

export default async function AdminDashboardPage() {
  const { admin } = await requireZuelenAdmin("/admin");
  const data = await getAdminData(admin);
  const s = data.stats;

  const cards = [
    { label: "Users", value: s.users, detail: "Authenticated product users", icon: UsersRound },
    { label: "Independents", value: s.independents, detail: "Independent workspaces", icon: UserRound },
    { label: "Companies", value: s.companies, detail: "Company workspaces", icon: Building2 },
    { label: "Accountants", value: s.accountants, detail: String(s.pendingAccountants) + " awaiting review", icon: BriefcaseBusiness },
    { label: "Active subscriptions", value: s.activeSubscriptions, detail: String(s.trialSubscriptions) + " trialing", icon: CreditCard },
    { label: "Waitlist", value: s.waitlistWaiting, detail: String(s.waitlistTotal) + " total requests", icon: Clock3 },
  ];

  return <main className={styles.shell}>
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Internal command center</span>
          <h1>Zuelen at a glance.</h1>
          <p>Monitor growth, subscriptions, professional reviews and the controlled Early Access rollout from one place.</p>
        </div>
        <div className={styles.heroBadge}><BadgeCheck size={16}/><div><strong>Admin access</strong><span>Restricted to contact@zuelen.lu</span></div></div>
      </section>

      <section className={styles.metrics}>
        {cards.map(item => {
          const Icon = item.icon;
          return <article key={item.label}>
            <div className={styles.metricIcon}><Icon size={18}/></div>
            <span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small>
          </article>;
        })}
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>Early Access</span><h2>Rollout pipeline</h2></div>
            <Link href="/admin/early-access">Manage waitlist <ArrowRight size={13}/></Link>
          </div>
          <div className={styles.pipeline}>
            <div><strong>{s.waitlistWaiting}</strong><span>Waiting</span></div><i>→</i>
            <div><strong>{s.waitlistInvited}</strong><span>Invited</span></div><i>→</i>
            <div><strong>{s.waitlistActivated}</strong><span>Activated</span></div>
          </div>
          <div className={styles.rows}>
            {data.recentWaitlist.length ? data.recentWaitlist.map(item => <div className={styles.row} key={item.id}>
              <div className={styles.avatar}>{item.email.slice(0,1).toUpperCase()}</div>
              <div className={styles.rowMain}><strong>{item.email}</strong><span>{audienceLabel[item.audience as keyof typeof audienceLabel]} · {item.locale.toUpperCase()}</span></div>
              <span className={styles.status + " " + styles[item.status]}>{item.status}</span>
              <time>{formatDate(item.created_at)}</time>
            </div>) : <p className={styles.empty}>No Early Access requests yet.</p>}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}><div><span>Subscriptions</span><h2>Commercial health</h2></div></div>
          <div className={styles.subscriptionGrid}>
            <div><CreditCard size={17}/><strong>{s.activeSubscriptions}</strong><span>Active</span></div>
            <div><WalletCards size={17}/><strong>{s.trialSubscriptions}</strong><span>Trialing</span></div>
            <div><XCircle size={17}/><strong>{s.cancellationsScheduled}</strong><span>Canceling</span></div>
          </div>
          <div className={styles.callout}><strong>Product + directory</strong><p>These totals combine organization subscriptions and accountant directory subscriptions.</p></div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>Users</span><h2>Recently joined</h2></div>
            <Link href="/admin/users">View users <ArrowRight size={13}/></Link>
          </div>
          <div className={styles.rows}>
            {data.recentUsers.length ? data.recentUsers.map(user => <div className={styles.row} key={user.id}>
              <div className={styles.avatar}>{(user.fullName || user.email).slice(0,1).toUpperCase()}</div>
              <div className={styles.rowMain}><strong>{user.fullName || user.email}</strong><span>{user.email}{user.types.length ? " · " + user.types.join(", ") : ""}</span></div>
              <span className={styles.plan}>{user.plan}</span>
              <time>{formatDate(user.createdAt)}</time>
            </div>) : <p className={styles.empty}>No product users yet.</p>}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>Accountant directory</span><h2>Moderation queue</h2></div>
            <Link href="/admin/accountants">Review profiles <ArrowRight size={13}/></Link>
          </div>
          {data.pendingAccountants.length ? <div className={styles.rows}>{data.pendingAccountants.map(profile => <div className={styles.row} key={profile.id}>
            <div className={styles.avatar}><UserRoundCheck size={15}/></div>
            <div className={styles.rowMain}><strong>{profile.full_name}</strong><span>{profile.firm_name || "Independent professional"}</span></div>
            <span className={styles.status + " " + styles.pending}>pending</span>
            <time>{formatDate(profile.updated_at)}</time>
          </div>)}</div> : <div className={styles.zeroState}><BadgeCheck size={22}/><strong>Review queue is clear</strong><p>No accountant profiles are waiting for approval.</p></div>}
        </article>
      </section>
    </div>
  </main>;
}
