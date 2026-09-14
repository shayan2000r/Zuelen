import Link from "next/link";
import { ExternalLink, Search, UsersRound } from "lucide-react";
import { requireZuelenAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-data";
import styles from "./users.module.css";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-LU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { admin } = await requireZuelenAdmin("/admin/users");
  const data = await getAdminData(admin);
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();

  const users = query ? data.users.filter(user =>
    user.email.toLowerCase().includes(query) ||
    (user.fullName ?? "").toLowerCase().includes(query) ||
    user.organizations.some(item => item.toLowerCase().includes(query)) ||
    user.types.some(item => item.toLowerCase().includes(query))
  ) : data.users;

  return <main className={styles.shell}>
    <div className={styles.page}>
      <section className={styles.hero}>
        <div><span>Users</span><h1>Product users.</h1><p>Authenticated Zuelen users, their workspace type, organizations, plan status and recent sign-in activity.</p></div>
        <div className={styles.total}><UsersRound size={18}/><strong>{data.stats.users}</strong><span>Total users</span></div>
      </section>

      <form className={styles.search} action="/admin/users">
        <Search size={15}/>
        <input name="q" defaultValue={q} placeholder="Search email, name, organization or user type"/>
        <button type="submit">Search</button>
        {query ? <Link href="/admin/users">Clear</Link> : null}
      </form>

      <section className={styles.tableWrap}>
        <table>
          <thead><tr><th>User</th><th>Type</th><th>Organization</th><th>Plan & status</th><th>Joined</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>
            {users.map(user => <tr key={user.id}>
              <td><strong>{user.fullName || user.email}</strong>{user.fullName ? <span>{user.email}</span> : null}</td>
              <td><div className={styles.tags}>{user.types.length ? user.types.map(type => <em key={type}>{type}</em>) : <span>—</span>}</div></td>
              <td>{user.organizations.length ? user.organizations.join(", ") : "—"}</td>
              <td>{user.accountState === "invite_pending"
                ? <span className={styles.pendingInvite}>Invite pending</span>
                : user.plan !== "—"
                  ? <span className={styles.planStatus}><strong>{user.plan}</strong><em>{user.subscriptionStatus}</em></span>
                  : <span className={styles.muted}>No subscription</span>}</td>
              <td>{formatDate(user.createdAt)}</td>
              <td>{formatDate(user.lastSignInAt)}</td>
              <td><Link className={styles.inspect} href={"/admin/users/" + user.id}>View account <ExternalLink size={11}/></Link></td>
            </tr>)}
          </tbody>
        </table>
        {!users.length ? <div className={styles.empty}>No users match this search.</div> : null}
      </section>
    </div>
  </main>;
}
