"use client";

import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  FileCheck2,
  FileCode2,
  FileOutput,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./live.module.css";
import frame from "./app-frame.module.css";
import "./topbar-polish.module.css";

type NavItem = { label: string; description: string; icon: LucideIcon; href: string };
type CollapsibleGroup = { key: "accounting" | "insights"; label: string; icon: LucideIcon; items: NavItem[] };
type Theme = "light" | "dark";

const primaryItems: NavItem[] = [
  { label: "Overview", description: "Company snapshot", icon: LayoutDashboard, href: "/app" },
  { label: "Transactions", description: "Review and post activity", icon: WalletCards, href: "/app/transactions" },
  { label: "Banking", description: "Statements and reconciliation", icon: Landmark, href: "/app/banking" },
  { label: "Invoices", description: "Sales and receivables", icon: ReceiptText, href: "/app/invoices" },
  { label: "Documents", description: "Company document vault", icon: FileText, href: "/app/documents" },
];

const collapsibleGroups: CollapsibleGroup[] = [
  {
    key: "accounting",
    label: "Accounting & tax",
    icon: BookOpen,
    items: [
      { label: "Accounting", description: "Double-entry journal", icon: BookOpen, href: "/app/accounting" },
      { label: "VAT filing", description: "VAT readiness", icon: FileOutput, href: "/app/vat" },
      { label: "Taxes", description: "Tax workspace", icon: Landmark, href: "/app/taxes" },
      { label: "Year-end", description: "Closing checklist", icon: CalendarCheck2, href: "/app/year-end" },
      { label: "Annual accounts", description: "eCDF preparation", icon: FileCode2, href: "/app/ecdf" },
      { label: "Compliance", description: "Deadlines and obligations", icon: FileCheck2, href: "/app/compliance" },
    ],
  },
  {
    key: "insights",
    label: "Insights & AI",
    icon: BarChart3,
    items: [
      { label: "Reports", description: "P&L and balance sheet", icon: BarChart3, href: "/app/reports" },
      { label: "Tax reserve", description: "Safe-to-use cash", icon: PiggyBank, href: "/app/tax-reserve" },
      { label: "Copilot", description: "Ask your books", icon: Sparkles, href: "/app/copilot" },
    ],
  },
];

const settingsItem: NavItem = { label: "Settings", description: "Company profile & preferences", icon: Settings, href: "/app/settings" };
const allItems = [...primaryItems, ...collapsibleGroups.flatMap((group) => group.items), settingsItem];

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function AppFrame({ children, companyName, fiscalYear, fiscalYears, email, attentionCount = 0, brandImageUrl = null }: { children: ReactNode; companyName: string; fiscalYear: number; fiscalYears: number[]; email: string | null; attentionCount?: number; brandImageUrl?: string | null }) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [switchingYear, setSwitchingYear] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<CollapsibleGroup["key"], boolean>>({
    accounting: pathname.startsWith("/app/accounting") || pathname.startsWith("/app/vat") || pathname.startsWith("/app/taxes") || pathname.startsWith("/app/year-end") || pathname.startsWith("/app/ecdf") || pathname.startsWith("/app/compliance"),
    insights: pathname.startsWith("/app/reports") || pathname.startsWith("/app/tax-reserve") || pathname.startsWith("/app/copilot"),
  });

  const userLabel = useMemo(() => email?.split("@")[0] ?? "Owner", [email]);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? allItems.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalized)) : allItems.slice(0, 8);
  }, [query]);

  useEffect(() => {
    const stored = window.localStorage.getItem("compta-theme");
    const initialTheme: Theme = stored === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.comptaTheme = initialTheme;
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("compta-theme", next);
    document.documentElement.dataset.comptaTheme = next;
  }

  function changeFiscalYear(next: number) {
    if (!Number.isInteger(next) || next === fiscalYear) return;
    setSwitchingYear(true);
    document.cookie = `compta-fiscal-year=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  useEffect(() => {
    for (const group of collapsibleGroups) {
      if (group.items.some((item) => pathname.startsWith(item.href))) setOpenGroups((current) => ({ ...current, [group.key]: true }));
    }
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setNotificationsOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navLink = (item: NavItem, nested = false) => {
    const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-active" : ""} ${nested ? frame.nestedNavItem : ""}`} onClick={() => setMobileNav(false)}><item.icon size={nested ? 14 : 16} /><span>{item.label}</span>{item.label === "Transactions" && attentionCount > 0 ? <em>{attentionCount}</em> : null}</Link>;
  };

  const avatar = (className: string) => brandImageUrl ? <span className={`${className} ${frame.imageAvatar}`}><img src={brandImageUrl} alt="" /></span> : <span className={className}>{initials(companyName).slice(0, 1) || "C"}</span>;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <Link href="/app" className={styles.brandLink}><div className="brand-mark"><span>C</span></div><div className="brand-word">Compta</div><span className={frame.brandBadge}>LU</span></Link>
          <button className="icon-btn mobile-only" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className={`company-switcher ${frame.yearSwitcher}`}>
          {avatar("company-avatar")}
          <span className={`company-copy ${frame.yearCopy}`}><strong>{companyName}</strong><span className={frame.yearSelectWrap}><span className={frame.yearHint}>Financial year</span><select className={frame.yearSelect} value={fiscalYear} disabled={switchingYear} onChange={(event) => changeFiscalYear(Number(event.target.value))} aria-label="Financial year">{fiscalYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={11}/></span></span>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          <div className={frame.primaryNav}>{primaryItems.map((item) => navLink(item))}</div>
          <div className={frame.groupDivider} />
          {collapsibleGroups.map((group) => {
            const isOpen = openGroups[group.key];
            const hasActiveChild = group.items.some((item) => pathname.startsWith(item.href));
            return <div className={frame.navGroup} key={group.key}><button type="button" className={`${frame.groupButton} ${hasActiveChild ? frame.groupButtonActive : ""}`} onClick={() => setOpenGroups((current) => ({ ...current, [group.key]: !current[group.key] }))} aria-expanded={isOpen}><group.icon size={16} /><span>{group.label}</span><ChevronDown className={isOpen ? frame.chevronOpen : ""} size={14} /></button><div className={`${frame.groupChildren} ${isOpen ? frame.groupChildrenOpen : ""}`}><div>{group.items.map((item) => navLink(item, true))}</div></div></div>;
          })}
          <div className={frame.groupDivider} />
          {navLink(settingsItem)}
        </nav>

        <div className="sidebar-spacer" />
        <div className={frame.themeRow}>
          <span>Appearance</span>
          <div className={frame.themeToggle} role="group" aria-label="Appearance">
            <button type="button" className={theme === "light" ? frame.themeActive : ""} onClick={() => applyTheme("light")} aria-label="Use light mode"><Sun size={14} /></button>
            <button type="button" className={theme === "dark" ? frame.themeActive : ""} onClick={() => applyTheme("dark")} aria-label="Use dark mode"><Moon size={14} /></button>
          </div>
        </div>
        <div className="user-row">
          <Link href="/app/settings" className={frame.userProfileLink}>{avatar("user-avatar")}<span><strong>{userLabel}</strong><small>Owner · Settings</small></span></Link>
          <form action="/auth/signout" method="post" className={styles.signOutForm}><button type="submit" className={styles.signOutButton} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button></form>
        </div>
      </aside>

      {mobileNav ? <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} /> : null}

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-btn mobile-only" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={18} /></button></div>
          <div className="topbar-actions">
            <button className="search-btn" type="button" onClick={() => setSearchOpen(true)} aria-label="Search Compta" title="Search Compta (⌘K)"><Search size={17} /></button>
            <div className={frame.notificationWrap}>
              <button className="icon-btn" type="button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((value) => !value)}><Bell size={17} />{attentionCount > 0 ? <span className="notification-dot" /> : null}</button>
              {notificationsOpen ? <div className={frame.notificationPanel}><div><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={14} /></button></div>{attentionCount ? <Link href="/app/transactions" onClick={() => setNotificationsOpen(false)}><span className={frame.noticeIcon}><WalletCards size={15} /></span><span><strong>{attentionCount} transaction{attentionCount === 1 ? "" : "s"} need review</strong><small>Open transaction review for {fiscalYear}</small></span></Link> : <p>You’re all caught up for {fiscalYear}.</p>}<Link href="/app/compliance" onClick={() => setNotificationsOpen(false)}><span className={frame.noticeIcon}><CalendarCheck2 size={15} /></span><span><strong>Compliance center</strong><small>Review {fiscalYear} obligations</small></span></Link></div> : null}
            </div>
            <Link className={`icon-btn ${frame.profileButton}`} href="/app/settings" aria-label={`Profile: ${userLabel}`} title="Profile & settings">{brandImageUrl ? <span className={frame.topAvatar}><img src={brandImageUrl} alt="" /></span> : <UserRound size={17} />}</Link>
          </div>
        </header>
        {children}
      </section>

      {searchOpen ? <div className={frame.searchOverlay} role="dialog" aria-modal="true" aria-label="Search Compta" onMouseDown={(event) => { if (event.currentTarget === event.target) setSearchOpen(false); }}><div className={frame.searchDialog}><div className={frame.searchInput}><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and workspaces…" /><button onClick={() => setSearchOpen(false)}><kbd>ESC</kbd></button></div><div className={frame.searchResults}><p>{query ? "Results" : "Quick navigation"}</p>{results.map((item) => <Link href={item.href} key={item.href} onClick={() => setSearchOpen(false)}><span><item.icon size={17} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div></Link>)}{results.length === 0 ? <div className={frame.noResults}>No matching workspace found.</div> : null}</div></div></div> : null}
    </main>
  );
}
