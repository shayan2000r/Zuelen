"use client";

import {
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  Check,
  ChevronDown,
  CreditCard,
  FileCheck2,
  FileText,
  Gauge,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { setLocalePreference } from "@/app/app/locale-actions";
import { LocaleProvider } from "@/components/locale-context";
import { RoleProvider } from "@/components/role-context";
import type { PlanName } from "@/lib/billing";
import type { OrganizationRole } from "@/lib/permissions";
import { localizedRole, t, type AccountTranslation, type Locale, type MessageKey } from "@/lib/i18n";
import styles from "./live.module.css";
import frame from "./app-frame.module.css";
import "./topbar-polish.module.css";

type NavItem = { label: string; description: string; icon: LucideIcon; href: string; premium?: boolean };
type GroupKey = "accounting" | "taxes" | "settings";
type CollapsibleGroup = { key: GroupKey; label: string; icon: LucideIcon; items: NavItem[] };
type Theme = "light" | "dark";

type AppFrameProps = {
  children: ReactNode;
  companyName: string;
  fiscalYear: number;
  fiscalYears: number[];
  email: string | null;
  userName: string | null;
  userRole: OrganizationRole | null;
  userAvatarUrl: string | null;
  attentionCount?: number;
  brandImageUrl?: string | null;
  locale: Locale;
  accountTranslations: AccountTranslation[];
  plan: PlanName;
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
}

export function AppFrame(props: AppFrameProps) {
  return <LocaleProvider locale={props.locale} accountTranslations={props.accountTranslations}><AppFrameInner {...props} /></LocaleProvider>;
}

function AppFrameInner({ children, companyName, fiscalYear, fiscalYears, email, userName, userRole, userAvatarUrl, attentionCount = 0, brandImageUrl = null, locale, plan }: AppFrameProps) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [switchingYear, setSwitchingYear] = useState(false);
  const [switchingLocale, startLocaleTransition] = useTransition();
  const accountRef = useRef<HTMLDivElement>(null);
  const tx = (key: MessageKey) => t(locale, key);
  const l = (en: string, fr: string) => locale === "fr" ? fr : en;

  const overview = useMemo<NavItem>(() => ({ label: tx("overview"), description: tx("companySnapshot"), icon: LayoutDashboard, href: "/app" }), [locale]);
  const accountingGroup = useMemo<CollapsibleGroup>(() => ({ key: "accounting", label: l("Accounting", "Comptabilité"), icon: BookOpen, items: [
    { label: l("Ledger", "Grand livre"), description: l("Journal and double-entry ledger", "Journal et comptabilité en partie double"), icon: BookOpen, href: "/app/accounting" },
    { label: tx("transactions"), description: tx("reviewPostActivity"), icon: WalletCards, href: "/app/transactions" },
    { label: tx("banking"), description: tx("statementsReconciliation"), icon: Landmark, href: "/app/banking" },
    { label: tx("invoices"), description: tx("salesReceivables"), icon: ReceiptText, href: "/app/invoices" },
  ] }), [locale]);
  const taxesGroup = useMemo<CollapsibleGroup>(() => ({ key: "taxes", label: l("Taxes", "Fiscalité"), icon: Landmark, items: [
    { label: l("Tax overview", "Vue fiscale"), description: l("Tax estimates and reserves", "Estimations et réserves fiscales"), icon: Landmark, href: "/app/taxes" },
    { label: "CCSS", description: l("Personal social-security planning", "Planification de la sécurité sociale personnelle"), icon: HeartHandshake, href: "/app/ccss" },
    { label: l("VAT", "TVA"), description: tx("vatReadiness"), icon: ReceiptText, href: "/app/vat" },
    { label: l("Year-end & accounts", "Clôture & comptes annuels"), description: l("Close the year and prepare annual accounts", "Clôturer l’exercice et préparer les comptes annuels"), icon: CalendarCheck2, href: "/app/year-end", premium: true },
    { label: l("Compliance calendar", "Calendrier conformité"), description: tx("deadlinesObligations"), icon: FileCheck2, href: "/app/compliance" },
  ] }), [locale]);
  const standaloneItems = useMemo<NavItem[]>(() => [
    { label: tx("reports"), description: tx("financialAnalyticsStatements"), icon: BarChart3, href: "/app/reports", premium: true },
    { label: tx("documents"), description: tx("companyDocumentVault"), icon: FileText, href: "/app/documents" },
    { label: tx("copilot"), description: tx("askYourBooks"), icon: Sparkles, href: "/app/copilot", premium: true },
    { label: l("Find an Accountant", "Trouver un comptable"), description: l("Browse independent accounting professionals", "Parcourir les professionnels comptables indépendants"), icon: BriefcaseBusiness, href: "/app/accountants" },
  ], [locale]);
  const settingsGroup = useMemo<CollapsibleGroup>(() => ({ key: "settings", label: tx("settings"), icon: Settings, items: [
    { label: l("Company", "Entreprise"), description: tx("companyProfilePreferences"), icon: Settings, href: "/app/settings" },
    { label: tx("myProfile"), description: l("Your profile and preferences", "Votre profil et préférences"), icon: UserRound, href: "/app/settings/profile" },
    { label: l("Team & access", "Équipe & accès"), description: l("Members, roles and invitations", "Membres, rôles et invitations"), icon: UsersRound, href: "/app/settings/team" },
    { label: l("Usage", "Utilisation"), description: l("Plan limits and current usage", "Limites de la formule et utilisation"), icon: Gauge, href: "/app/settings/usage" },
    { label: l("Subscription & billing", "Abonnement & facturation"), description: l("Plan, seats and payment settings", "Formule, sièges et paiements"), icon: CreditCard, href: "/app/settings/billing" },
  ] }), [locale]);

  const groups = useMemo(() => [accountingGroup, taxesGroup], [accountingGroup, taxesGroup]);
  const allItems = useMemo(() => [overview, ...groups.flatMap(group => group.items), ...standaloneItems, ...settingsGroup.items], [overview, groups, standaloneItems, settingsGroup]);
  const [openGroups, setOpenGroups] = useState<Record<GroupKey, boolean>>({
    accounting: pathname.startsWith("/app/accounting") || pathname.startsWith("/app/transactions") || pathname.startsWith("/app/banking") || pathname.startsWith("/app/invoices"),
    taxes: pathname.startsWith("/app/taxes") || pathname.startsWith("/app/ccss") || pathname.startsWith("/app/vat") || pathname.startsWith("/app/year-end") || pathname.startsWith("/app/ecdf") || pathname.startsWith("/app/compliance"),
    settings: pathname.startsWith("/app/settings"),
  });
  const userLabel = useMemo(() => userName?.trim() || email?.split("@")[0] || tx("member"), [userName, email, locale]);
  const roleLabel = localizedRole(locale, userRole);
  const results = useMemo(() => { const normalized = query.trim().toLowerCase(); return normalized ? allItems.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(normalized)) : allItems.slice(0, 9); }, [query, allItems]);

  useEffect(() => { const stored = window.localStorage.getItem("zuelen-theme"); const initialTheme: Theme = stored === "dark" ? "dark" : "light"; setTheme(initialTheme); document.documentElement.dataset.zuelenTheme = initialTheme; }, []);
  useEffect(() => { for (const group of [...groups, settingsGroup]) { if (group.items.some(item => item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href))) setOpenGroups(current => ({ ...current, [group.key]: true })); } }, [pathname, groups, settingsGroup]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); } if (event.key === "Escape") { setSearchOpen(false); setNotificationsOpen(false); setLanguageOpen(false); setAccountOpen(false); } };
    const onMouse = (event: MouseEvent) => { if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false); };
    window.addEventListener("keydown", onKey); document.addEventListener("mousedown", onMouse); return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onMouse); };
  }, []);

  function applyTheme(next: Theme) { setTheme(next); window.localStorage.setItem("zuelen-theme", next); document.documentElement.dataset.zuelenTheme = next; }
  function changeFiscalYear(next: number) { if (!Number.isInteger(next) || next === fiscalYear) return; setSwitchingYear(true); document.cookie = `zuelen-fiscal-year=${next}; Path=/; Max-Age=31536000; SameSite=Lax`; window.location.reload(); }
  function changeLocale(next: Locale) { if (next === locale || switchingLocale) return; setLanguageOpen(false); startLocaleTransition(async () => { await setLocalePreference(next); window.location.reload(); }); }

  const navLink = (item: NavItem, nested = false) => { const active = item.href === "/app" ? pathname === "/app" : pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-active" : ""} ${nested ? frame.nestedNavItem : ""}`} onClick={() => setMobileNav(false)}><item.icon size={nested ? 14 : 16}/><span>{item.label}</span>{plan === "basic" && item.premium ? <span className={frame.premiumNavBadge}>Premium</span> : item.href === "/app/transactions" && attentionCount > 0 ? <em>{attentionCount}</em> : null}</Link>; };
  const renderGroup = (group: CollapsibleGroup) => { const isOpen = openGroups[group.key]; const hasActiveChild = group.items.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/app/year-end" && pathname.startsWith("/app/ecdf"))); return <div className={frame.navGroup} key={group.key}><button type="button" className={`${frame.groupButton} ${hasActiveChild ? frame.groupButtonActive : ""}`} onClick={() => setOpenGroups(current => ({ ...current, [group.key]: !current[group.key] }))} aria-expanded={isOpen}><group.icon size={16}/><span>{group.label}</span><ChevronDown className={isOpen ? frame.chevronOpen : ""} size={14}/></button><div className={`${frame.groupChildren} ${isOpen ? frame.groupChildrenOpen : ""}`}><div>{group.items.map(item => navLink(item, true))}</div></div></div>; };
  const companyAvatar = (className: string) => brandImageUrl ? <span className={`${className} ${frame.imageAvatar}`}><img src={brandImageUrl} alt=""/></span> : <span className={className}>{initials(companyName).slice(0, 1) || "C"}</span>;
  const personalAvatar = (className: string) => userAvatarUrl ? <span className={`${className} ${frame.imageAvatar}`}><img src={userAvatarUrl} alt=""/></span> : <span className={className}>{initials(userLabel) || <UserRound size={16}/>}</span>;

  return <RoleProvider role={userRole}>
    <main className="app-shell" data-role={userRole ?? "member"} data-locale={locale} data-plan={plan}>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-row"><Link href="/app" className={styles.brandLink}><span className={frame.brandMark}><Image src="/zuelen-icon.png" alt="" width={31} height={31} priority /></span><div className="brand-word">Zuelen</div><span className={frame.brandBadge}>LU</span></Link><button className="icon-btn mobile-only" onClick={() => setMobileNav(false)} aria-label={tx("closeNavigation")}><X size={18}/></button></div>
        <div className={`company-switcher ${frame.yearSwitcher}`}>{companyAvatar("company-avatar")}<span className={`company-copy ${frame.yearCopy}`}><strong>{companyName}</strong><span className={frame.yearSelectWrap}><span className={frame.yearHint}>{tx("financialYear")}</span><select className={frame.yearSelect} value={fiscalYear} disabled={switchingYear} onChange={event => changeFiscalYear(Number(event.target.value))} aria-label={tx("financialYear")}>{fiscalYears.map(year => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={11}/><span className={frame.companyPlanBadge}>{plan === "premium" ? "Premium" : "Basic"}</span></span></span></div>
        <nav className="nav-list" aria-label={locale === "fr" ? "Navigation principale" : "Primary navigation"}><div className={frame.primaryNav}>{navLink(overview)}</div><div className={frame.groupDivider}/>{groups.map(renderGroup)}<div className={frame.groupDivider}/><div className={frame.primaryNav}>{standaloneItems.map(item => navLink(item))}</div><div className={frame.groupDivider}/>{renderGroup(settingsGroup)}</nav>
        <div className="sidebar-spacer"/><div className={frame.themeRow}><span>{tx("appearance")}</span><div className={frame.themeToggle} role="group" aria-label={tx("appearance")}><button type="button" className={theme === "light" ? frame.themeActive : ""} onClick={() => applyTheme("light")} aria-label={tx("lightMode")}><Sun size={14}/></button><button type="button" className={theme === "dark" ? frame.themeActive : ""} onClick={() => applyTheme("dark")} aria-label={tx("darkMode")}><Moon size={14}/></button></div></div>
        <div className={`user-row ${frame.userFooterCard}`}><Link href="/app/settings/profile" className={frame.userProfileLink}>{personalAvatar("user-avatar")}<span><strong>{userLabel}</strong><small>{roleLabel} · {tx("myProfile")}</small></span></Link><form action="/auth/signout" method="post" className={styles.signOutForm}><button type="submit" className={styles.signOutButton} aria-label={tx("signOut")} title={tx("signOut")}><LogOut size={15}/></button></form></div>
      </aside>

      {mobileNav ? <button className="scrim" aria-label={tx("closeNavigation")} onClick={() => setMobileNav(false)}/> : null}
      <section className="workspace">
        <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-only" onClick={() => setMobileNav(true)} aria-label={tx("openNavigation")}><Menu size={18}/></button></div><div className="topbar-actions">
          <div className={frame.languageWrap}><button type="button" className={frame.languageButton} onClick={() => setLanguageOpen(value => !value)} aria-expanded={languageOpen} aria-label={tx("language")}><span className={frame.languageFlag}>{locale === "fr" ? "🇫🇷" : "🇬🇧"}</span><span>{locale.toUpperCase()}</span><ChevronDown size={13} className={languageOpen ? frame.chevronOpen : ""}/></button>{languageOpen ? <div className={frame.languageMenu}><button type="button" className={locale === "en" ? frame.languageChoiceActive : ""} onClick={() => changeLocale("en")} disabled={switchingLocale}><span>🇬🇧</span><span><strong>English</strong><small>EN</small></span></button><button type="button" className={locale === "fr" ? frame.languageChoiceActive : ""} onClick={() => changeLocale("fr")} disabled={switchingLocale}><span>🇫🇷</span><span><strong>Français</strong><small>FR</small></span></button></div> : null}</div>
          <button className="search-btn" type="button" onClick={() => setSearchOpen(true)} aria-label={tx("searchZuelen")} title={`${tx("searchZuelen")} (⌘K)`}><Search size={17}/></button>
          <div className={frame.notificationWrap}><button className="icon-btn" type="button" aria-label={tx("notifications")} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(value => !value)}><Bell size={17}/>{attentionCount > 0 ? <span className="notification-dot"/> : null}</button>{notificationsOpen ? <div className={frame.notificationPanel}><div><strong>{tx("notifications")}</strong><button onClick={() => setNotificationsOpen(false)} aria-label={tx("closeNotifications")}><X size={14}/></button></div>{attentionCount ? <Link href="/app/transactions" onClick={() => setNotificationsOpen(false)}><span className={frame.noticeIcon}><WalletCards size={15}/></span><span><strong>{locale === "fr" ? `${attentionCount} transaction${attentionCount === 1 ? "" : "s"} à vérifier` : `${attentionCount} transaction${attentionCount === 1 ? "" : "s"} need review`}</strong><small>{locale === "fr" ? `Ouvrir la vérification des transactions pour ${fiscalYear}` : `Open transaction review for ${fiscalYear}`}</small></span></Link> : <p>{locale === "fr" ? `Tout est à jour pour ${fiscalYear}.` : `You’re all caught up for ${fiscalYear}.`}</p>}<Link href="/app/compliance" onClick={() => setNotificationsOpen(false)}><span className={frame.noticeIcon}><CalendarCheck2 size={15}/></span><span><strong>{tx("complianceCenter")}</strong><small>{locale === "fr" ? `Vérifier les obligations ${fiscalYear}` : `Review ${fiscalYear} obligations`}</small></span></Link></div> : null}</div>
          <div className={frame.businessAccountWrap} ref={accountRef}><button type="button" className={frame.businessAccountButton} onClick={() => setAccountOpen(value => !value)} aria-expanded={accountOpen} aria-label={l(`Open account menu for ${userLabel}`, `Ouvrir le menu du compte de ${userLabel}`)}>{userAvatarUrl ? <span className={frame.businessAvatar}><img src={userAvatarUrl} alt=""/></span> : <span className={frame.businessAvatar}>{initials(userLabel)}</span>}<div><strong>{userLabel}</strong><small>{companyName}</small></div><ChevronDown size={14}/></button>{accountOpen ? <div className={frame.businessAccountMenu}><div className={frame.businessAccountHead}><strong>{userLabel}</strong><span>{email}</span></div><div className={frame.businessAccountSection}><span>{l("Workspaces", "Espaces")}</span><Link href="/app" className={frame.businessCurrentWorkspace}><Building2 size={15}/><div><strong>{l("Business", "Entreprise")}</strong><small>{companyName}</small></div><Check size={14}/></Link><Link href="/professional"><BriefcaseBusiness size={15}/><div><strong>{l("Professional", "Professionnel")}</strong><small>{l("Switch or create accountant workspace", "Ouvrir ou créer l’espace comptable")}</small></div></Link></div><div className={frame.businessAccountSection}><Link href="/app/settings/profile"><Settings size={15}/><div><strong>{tx("settings")}</strong><small>{l("Profile and account preferences", "Profil et préférences du compte")}</small></div></Link><form action="/auth/signout" method="post"><button type="submit"><LogOut size={15}/><span>{tx("signOut")}</span></button></form></div></div> : null}</div>
        </div></header>{children}
      </section>
      {searchOpen ? <div className={frame.searchOverlay} role="dialog" aria-modal="true" aria-label={tx("searchZuelen")} onMouseDown={event => { if (event.currentTarget === event.target) setSearchOpen(false); }}><div className={frame.searchDialog}><div className={frame.searchInput}><Search size={18}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={tx("searchPlaceholder")}/><button onClick={() => setSearchOpen(false)}><kbd>ESC</kbd></button></div><div className={frame.searchResults}><p>{query ? tx("results") : tx("quickNavigation")}</p>{results.map(item => <Link href={item.href} key={item.href} onClick={() => setSearchOpen(false)}><span><item.icon size={17}/></span><div><strong>{item.label}</strong><small>{item.description}</small></div></Link>)}{results.length === 0 ? <div className={frame.noResults}>{tx("noMatchingWorkspace")}</div> : null}</div></div></div> : null}
    </main>
  </RoleProvider>;
}
