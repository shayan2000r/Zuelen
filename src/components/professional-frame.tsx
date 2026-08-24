"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BriefcaseBusiness, Building2, CreditCard, LayoutDashboard, Menu, Moon, Search, Sun, UserRound, X } from "lucide-react";
import styles from "./professional-frame.module.css";

type Props = {
  children: ReactNode;
  name: string;
  firmName: string | null;
  email: string | null;
  photoUrl: string | null;
  approvalStatus: string;
  plan: "basic" | "premium" | null;
  hasBusinessWorkspace: boolean;
};

type Theme = "light" | "dark";

const nav = [
  { href: "/professional", label: "Overview", icon: LayoutDashboard },
  { href: "/professional/profile", label: "My profile", icon: UserRound },
  { href: "/professional/billing", label: "Subscription & billing", icon: CreditCard },
  { href: "/accountants/directory", label: "Accountant directory", icon: Search },
];

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "A";
}

function approvalLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending review";
  if (status === "rejected") return "Changes required";
  return "Draft";
}

export function ProfessionalFrame({ children, name, firmName, email, photoUrl, approvalStatus, plan, hasBusinessWorkspace }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("zuelen-theme");
    const next: Theme = stored === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.zuelenTheme = next;
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("zuelen-theme", next);
    document.documentElement.dataset.zuelenTheme = next;
  }

  const activeTitle = pathname.startsWith("/professional/profile")
    ? "My profile"
    : pathname.startsWith("/professional/billing")
      ? "Subscription & billing"
      : pathname.startsWith("/accountants/directory")
        ? "Accountant directory"
        : "Overview";

  return (
    <main className={styles.shell}>
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brandRow}>
          <Link href="/professional" className={styles.brand} onClick={() => setMobileOpen(false)}>
            <img src="/zuelen-icon.png" alt="" />
            <strong>Zuelen</strong>
            <span>Professionals</span>
          </Link>
          <button className={styles.mobileClose} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className={styles.identity}>
          {photoUrl ? <img src={photoUrl} alt="" /> : <span className={styles.avatar}>{initials(name)}</span>}
          <div>
            <strong>{name}</strong>
            <small>{firmName || email || "Professional profile"}</small>
          </div>
          <span className={`${styles.status} ${styles[approvalStatus] ?? ""}`}>{approvalLabel(approvalStatus)}</span>
        </div>

        <nav className={styles.nav} aria-label="Professional navigation">
          {nav.map(item => {
            const active = item.href === "/professional"
              ? pathname === "/professional"
              : item.href === "/accountants/directory"
                ? pathname.startsWith("/accountants/directory")
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={active ? styles.active : ""} onClick={() => setMobileOpen(false)}><Icon size={16}/><span>{item.label}</span></Link>;
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          {hasBusinessWorkspace ? <Link href="/app" className={styles.businessLink}><Building2 size={15}/><span>Business workspace</span></Link> : null}
          <div className={styles.appearance}>
            <span>Appearance</span>
            <div>
              <button type="button" className={theme === "light" ? styles.themeActive : ""} onClick={() => applyTheme("light")} aria-label="Light mode"><Sun size={14}/></button>
              <button type="button" className={theme === "dark" ? styles.themeActive : ""} onClick={() => applyTheme("dark")} aria-label="Dark mode"><Moon size={14}/></button>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen ? <button className={styles.scrim} aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}

      <section className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.mobileMenu} onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18}/></button>
          <div><span>Professional workspace</span><strong>{activeTitle}</strong></div>
          <Link href="/accountants/directory" className={styles.directoryLink}><BriefcaseBusiness size={15}/> View directory</Link>
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  );
}
