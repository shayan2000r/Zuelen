import Link from "next/link";
import { Search, ShieldCheck, UsersRound } from "lucide-react";
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
  const { admin, email } = await requireZuelenAdmin("/admin/users");
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
    <header className={styles.topbar}>
      <Link href="/admin" className={styles.brand}><img src="/zuelen-icon.png" alt=""/><strong>Zuelen</strong><span>Admin</span></Link>
      <nav>
        <Link href="/admin">Overview</Link>
        <Link className={styles.active} href="/admin/users">Users</Link>
        <Link href="/admin/accountants">Accountants</Link>
        <Link href="/admin/early-access">Waitlist</Link>
      </nav>
      <div className={styles.identity}><ShieldCheck size={14}/><span>{email}</span></div>
    </header>

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
          <thead><tr><th>User</th><th>Type</th><th>Organization</th><th>Plan</th><th>Joined</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {users.map(user => <tr key={user.id}>
              <td><strong>{user.fullName || user.email}</strong>{user.fullName ? <span>{user.email}</span> : null}</td>
              <td><div className={styles.tags}>{user.types.length ? user.types.map(type => <em key={type}>{type}</em>) : <span>—</span>}</div></td>
              <td>{user.organizations.length ? user.organizations.join(", ") : "—"}</td>
              <td><span className={styles.plan}>{user.plan}</span><small>{user.subscriptionStatus}</small></td>
              <td>{formatDate(user.createdAt)}</td>
              <td>{formatDate(user.lastSignInAt)}</td>
            </tr>)}
          </tbody>
        </table>
        {!users.length ? <div className={styles.empty}>No users match this search.</div> : null}
      </section>
    </div>
  </main>;
}
