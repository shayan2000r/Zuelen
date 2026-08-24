"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { BarChart3, Bell, BriefcaseBusiness, Building2, Check, ChevronDown, CreditCard, LayoutDashboard, LogOut, Menu, Moon, Search, Settings, Sun, UserRound, X } from "lucide-react";
import { setLocalePreference } from "@/app/app/locale-actions";
import type { Locale } from "@/lib/i18n";
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
  locale: Locale;
};

type Theme = "light" | "dark";
const MOBILE_NAV_QUERY = "(max-width: 900px)";

function subscribeToMobileViewport(onChange: () => void) {
  const media = window.matchMedia(MOBILE_NAV_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(MOBILE_NAV_QUERY).matches;
}

function getServerViewportSnapshot() {
  return false;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "A";
}

export function ProfessionalFrame({ children, name, firmName, email, photoUrl, approvalStatus, plan, hasBusinessWorkspace, locale }: Props) {
  const pathname = usePathname();
  const isMobileViewport = useSyncExternalStore(subscribeToMobileViewport, getMobileViewportSnapshot, getServerViewportSnapshot);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [accountOpen, setAccountOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [switchingLocale, startLocaleTransition] = useTransition();
  const accountRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;

  const nav = useMemo(() => [
    { href: "/professional", label: l("Overview", "Vue d’ensemble"), description: l("Your professional snapshot", "Votre aperçu professionnel"), icon: LayoutDashboard },
    { href: "/accountants/directory", label: l("Directory", "Annuaire"), description: l("Browse the professional network", "Parcourir le réseau professionnel"), icon: Search },
    { href: "/professional/profile", label: l("My profile", "Mon profil"), description: l("Manage your public listing", "Gérer votre profil public"), icon: UserRound },
    { href: "/professional/analytics", label: l("Analytics", "Statistiques"), description: l("Views, clicks and engagement", "Vues, clics et engagement"), icon: BarChart3 },
    { href: "/professional/billing", label: l("Subscription & billing", "Abonnement & facturation"), description: l("Plan and payment settings", "Formule et paiements"), icon: CreditCard },
    { href: "/professional/settings", label: l("Settings", "Paramètres"), description: l("Language, notifications and account", "Langue, notifications et compte"), icon: Settings },
  ], [locale]);

  const approvalLabel = (status: string) => {
    if (status === "approved") return l("Approved", "Approuvé");
    if (status === "pending") return l("Pending review", "En cours de vérification");
    if (status === "rejected") return l("Changes required", "Modifications requises");
    return l("Draft", "Brouillon");
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("zuelen-theme");
    const next: Theme = stored === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.zuelenTheme = next;
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountRef.current && !accountRef.current.contains(target)) setAccountOpen(false);
      if (languageRef.current && !languageRef.current.contains(target)) setLanguageOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(target)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setAccountOpen(false);
        setLanguageOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("zuelen-theme", next);
    document.documentElement.dataset.zuelenTheme = next;
  }

  function changeLocale(next: Locale) {
    if (next === locale || switchingLocale) return;
    setLanguageOpen(false);
    startLocaleTransition(async () => {
      await setLocalePreference(next);
      window.location.reload();
    });
  }

  const activeTitle = pathname.startsWith("/professional/profile")
    ? l("My profile", "Mon profil")
    : pathname.startsWith("/professional/analytics")
      ? l("Analytics", "Statistiques")
      : pathname.startsWith("/professional/billing")
        ? l("Subscription & billing", "Abonnement & facturation")
        : pathname.startsWith("/professional/settings")
          ? l("Settings", "Paramètres")
          : pathname.startsWith("/accountants/directory")
            ? l("Directory", "Annuaire")
            : l("Overview", "Vue d’ensemble");

  const workspaceLabel = plan === "premium" ? "Premium" : plan === "basic" ? "Basic" : l("Professional", "Professionnel");
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = normalizedQuery ? nav.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery)) : nav;
  const mobileSidebarHidden = isMobileViewport && !mobileOpen;

  return (
    <main className={styles.shell}>
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} aria-hidden={mobileSidebarHidden} inert={mobileSidebarHidden}>
        <div className={styles.brandRow}>
          <Link href="/professional" className={styles.brand} onClick={() => setMobileOpen(false)}>
            <img src="/zuelen-icon.png" alt="" />
            <strong>Zuelen</strong>
            <span>Pro</span>
          </Link>
          <button className={styles.mobileClose} type="button" onClick={() => setMobileOpen(false)} aria-label={l("Close navigation", "Fermer la navigation")}><X size={18} /></button>
        </div>

        <div className={styles.identity}>
          {photoUrl ? <img src={photoUrl} alt="" /> : <span className={styles.avatar}>{initials(name)}</span>}
          <div><strong>{name}</strong><small>{firmName || email || l("Professional profile", "Profil professionnel")}</small></div>
          <span className={`${styles.status} ${styles[approvalStatus] ?? ""}`}>{approvalLabel(approvalStatus)}</span>
        </div>

        <nav className={styles.nav} aria-label={l("Professional navigation", "Navigation professionnelle")}>
          {nav.map(item => {
            const active = item.href === "/professional" ? pathname === "/professional" : item.href === "/accountants/directory" ? pathname.startsWith("/accountants/directory") : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={active ? styles.active : ""} onClick={() => setMobileOpen(false)}><Icon size={16}/><span>{item.label}</span></Link>;
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.appearance}><span>{l("Appearance", "Apparence")}</span><div><button type="button" className={theme === "light" ? styles.themeActive : ""} onClick={() => applyTheme("light")} aria-label={l("Light mode", "Mode clair")}><Sun size={14}/></button><button type="button" className={theme === "dark" ? styles.themeActive : ""} onClick={() => applyTheme("dark")} aria-label={l("Dark mode", "Mode sombre")}><Moon size={14}/></button></div></div>
        </div>
      </aside>

      {mobileOpen ? <button className={styles.scrim} aria-label={l("Close navigation", "Fermer la navigation")} onClick={() => setMobileOpen(false)} /> : null}

      <section className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.mobileMenu} onClick={() => setMobileOpen(true)} aria-label={l("Open navigation", "Ouvrir la navigation")}><Menu size={18}/></button>
          <div className={styles.pageTitle}><span>{l("Professional workspace", "Espace professionnel")}</span><strong>{activeTitle}</strong></div>

          <div className={styles.topActions}>
            <div className={styles.languageWrap} ref={languageRef}>
              <button type="button" className={styles.languageButton} onClick={() => setLanguageOpen(value => !value)} aria-expanded={languageOpen} aria-label={l("Change language. Current language: English", "Changer de langue. Langue actuelle : français")}>
                <span className={styles.languageFlag}>{locale === "fr" ? "🇫🇷" : "🇬🇧"}</span><strong>{locale.toUpperCase()}</strong><ChevronDown size={13}/>
              </button>
              {languageOpen ? <div className={styles.languageMenu}>
                <button type="button" className={locale === "en" ? styles.languageChoiceActive : ""} onClick={() => changeLocale("en")} disabled={switchingLocale}><span>🇬🇧</span><span><strong>English</strong><small>EN</small></span>{locale === "en" ? <Check size={14}/> : null}</button>
                <button type="button" className={locale === "fr" ? styles.languageChoiceActive : ""} onClick={() => changeLocale("fr")} disabled={switchingLocale}><span>🇫🇷</span><span><strong>Français</strong><small>FR</small></span>{locale === "fr" ? <Check size={14}/> : null}</button>
              </div> : null}
            </div>

            <button className={styles.iconButton} type="button" onClick={() => setSearchOpen(true)} aria-label={l("Search Zuelen", "Rechercher dans Zuelen")} title="⌘K"><Search size={17}/></button>

            <div className={styles.notificationWrap} ref={notificationsRef}>
              <button className={styles.iconButton} type="button" onClick={() => setNotificationsOpen(value => !value)} aria-expanded={notificationsOpen} aria-label={l("Notifications", "Notifications")}><Bell size={17}/>{approvalStatus !== "approved" ? <span className={styles.notificationDot}/> : null}</button>
              {notificationsOpen ? <div className={styles.notificationPanel}><div><strong>{l("Notifications", "Notifications")}</strong><button type="button" onClick={() => setNotificationsOpen(false)} aria-label={l("Close notifications", "Fermer les notifications")}><X size={14}/></button></div>{approvalStatus === "pending" ? <Link href="/professional/profile"><span className={styles.noticeIcon}><UserRound size={15}/></span><span><strong>{l("Profile review in progress", "Vérification du profil en cours")}</strong><small>{l("We’ll email you as soon as Zuelen completes the review.", "Nous vous enverrons un e-mail dès que la vérification sera terminée.")}</small></span></Link> : approvalStatus === "rejected" ? <Link href="/professional/profile"><span className={styles.noticeIcon}><UserRound size={15}/></span><span><strong>{l("Your profile needs changes", "Votre profil nécessite des modifications")}</strong><small>{l("Open My Profile to review the requested changes.", "Ouvrez Mon profil pour consulter les modifications demandées.")}</small></span></Link> : <p>{l("You’re all caught up.", "Tout est à jour.")}</p>}</div> : null}
            </div>

            <div className={styles.accountWrap} ref={accountRef}>
              <button type="button" className={styles.accountButton} onClick={() => setAccountOpen(value => !value)} aria-expanded={accountOpen} aria-label={l("Open account menu", "Ouvrir le menu du compte")}>
                {photoUrl ? <img src={photoUrl} alt=""/> : <span>{initials(name)}</span>}
                <div><strong>{name}</strong><small>{workspaceLabel}</small></div><ChevronDown size={14}/>
              </button>
              {accountOpen ? <div className={styles.accountMenu}>
                <div className={styles.accountMenuHead}><strong>{name}</strong><span>{email}</span></div>
                <div className={styles.accountMenuSection}><span>{l("Workspaces", "Espaces")}</span><Link href="/professional" className={styles.currentWorkspace}><BriefcaseBusiness size={15}/><div><strong>{l("Professional", "Professionnel")}</strong><small>{l("Accountant workspace", "Espace comptable")}</small></div><Check size={14}/></Link><Link href={hasBusinessWorkspace ? "/app" : "/setup"}><Building2 size={15}/><div><strong>{hasBusinessWorkspace ? l("Business", "Entreprise") : l("Create business workspace", "Créer un espace entreprise")}</strong><small>{hasBusinessWorkspace ? l("Switch workspace", "Changer d’espace") : l("Use the same Zuelen login", "Utiliser le même compte Zuelen")}</small></div></Link></div>
                <div className={styles.accountMenuSection}><Link href="/professional/settings"><Settings size={15}/><div><strong>{l("Settings", "Paramètres")}</strong><small>{l("Language, notifications and account", "Langue, notifications et compte")}</small></div></Link><form action="/auth/signout" method="post"><button type="submit"><LogOut size={15}/><span>{l("Sign out", "Se déconnecter")}</span></button></form></div>
              </div> : null}
            </div>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </section>

      {searchOpen ? <div className={styles.searchOverlay} role="dialog" aria-modal="true" aria-label={l("Search professional workspace", "Rechercher dans l’espace professionnel")} onMouseDown={event => { if (event.currentTarget === event.target) setSearchOpen(false); }}><div className={styles.searchDialog}><div className={styles.searchInput}><Search size={18}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={l("Search professional workspace…", "Rechercher dans l’espace professionnel…")}/><button type="button" onClick={() => setSearchOpen(false)} aria-label={l("Close search", "Fermer la recherche")}><kbd>ESC</kbd></button></div><div className={styles.searchResults}><p>{normalizedQuery ? l("Results", "Résultats") : l("Quick navigation", "Navigation rapide")}</p>{searchResults.map(item => <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)}><span><item.icon size={17}/></span><div><strong>{item.label}</strong><small>{item.description}</small></div></Link>)}</div></div></div> : null}
    </main>
  );
}
