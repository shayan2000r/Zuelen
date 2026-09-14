"use client";

import { LogOut, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin-header.module.css";

const nav = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/accountants", label: "Accountants" },
  { href: "/admin/early-access", label: "Waitlist" },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminHeader({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <Link href="/admin" className={styles.brand}>
        <img src="/zuelen-icon.png" alt="" />
        <strong>Zuelen</strong>
        <span>Admin</span>
      </Link>

      <nav className={styles.nav} aria-label="Admin navigation">
        {nav.map(item => {
          const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = "icon" in item ? item.icon : null;
          return (
            <Link key={item.href} href={item.href} className={active ? styles.active : undefined}>
              {Icon ? <Icon size={13} /> : null}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.account}>
        <div className={styles.identity}>
          <ShieldCheck size={14} />
          <span>{email}</span>
        </div>
        <form method="post" action="/auth/signout">
          <button type="submit" className={styles.signOut} title="Sign out">
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
