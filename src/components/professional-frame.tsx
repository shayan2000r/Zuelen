"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { BriefcaseBusiness, Building2, Check, ChevronDown, CreditCard, Languages, LayoutDashboard, LogOut, Menu, Moon, Search, Settings, Sun, UserRound, X } from "lucide-react";
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

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "A";
}

export function ProfessionalFrame({ children, name, firmName, email, photoUrl, approvalStatus, plan, hasBusinessWorkspace, locale }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [accountOpen, setAccountOpen] = useState(false);
  const [switchingLocale, startLocaleTransition] = useTransition();
  const accountRef = useRef<HTMLDivElement>(null);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;

  const nav = useMemo(() => [
    { href: "/professional", label: l("Overview", "Vue d’ensemble"), icon: LayoutDashboard },
    { href: "/accountants/directory", label: l("Directory", "Annuaire"), icon: Search },
    { href: "/professional/profile", label: l("My profile", "Mon profil"), icon: UserRound },
    { href: "/professional/billing", label: l("Subscription & billing", "Abonnement & facturation"), icon: CreditCard },
    { href: "/professional/settings", label: l("Settings", "Paramètres"), icon: Settings },
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
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("zuelen-theme", next);
    document.documentElement.dataset.zuelenTheme = next;
  }

  function changeLocale(next: Locale) {
    if (next === locale || switchingLocale) return;
    startLocaleTransition(async () => {
      await setLocalePreference(next);
      window.location.reload();
    });
  }

  const activeTitle = pathname.startsWith("/professional/profile")
    ? l("My profile", "Mon profil")
    : pathname.startsWith("/professional/billing")
      ? l("Subscription & billing", "Abonnement & facturation")
      : pathname.startsWith("/professional/settings")
        ? l("Settings", "Paramètres")
        : pathname.startsWith("/accountants/directory")
          ? l("Directory", "Annuaire")
          : l("Overview", "Vue d’ensemble");

  const workspaceLabel = plan === "premium" ? "Premium" : plan === "basic" ? "Basic" : l("Professional", "Professionnel");

  return (
    <main className={styles.shell}>
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
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
          <div>
            <strong>{name}</strong>
            <small>{firmName || email || l("Professional profile", "Profil professionnel")}</small>
          </div>
          <span className={`${styles.status} ${styles[approvalStatus] ?? ""}`}>{approvalLabel(approvalStatus)}</span>
        </div>

        <nav className={styles.nav} aria-label={l("Professional navigation", "Navigation professionnelle")}>
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
          <div className={styles.appearance}>
            <span>{l("Appearance", "Apparence")}</span>
            <div>
              <button type="button" className={theme === "light" ? styles.themeActive : ""} onClick={() => applyTheme("light")} aria-label={l("Light mode", "Mode clair")}><Sun size={14}/></button>
              <button type="button" className={theme === "dark" ? styles.themeActive : ""} onClick={() => applyTheme("dark")} aria-label={l("Dark mode", "Mode sombre")}><Moon size={14}/></button>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen ? <button className={styles.scrim} aria-label={l("Close navigation", "Fermer la navigation")} onClick={() => setMobileOpen(false)} /> : null}

      <section className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.mobileMenu} onClick={() => setMobileOpen(true)} aria-label={l("Open navigation", "Ouvrir la navigation")}><Menu size={18}/></button>
          <div className={styles.pageTitle}><span>{l("Professional workspace", "Espace professionnel")}</span><strong>{activeTitle}</strong></div>

          <div className={styles.topActions}>
            <div className={styles.languageSwitcher} role="group" aria-label={l("Language", "Langue")}>
              <Languages size={14}/>
              <button type="button" className={locale === "en" ? styles.languageActive : ""} onClick={() => changeLocale("en")} disabled={switchingLocale}>EN</button>
              <span>/</span>
              <button type="button" className={locale === "fr" ? styles.languageActive : ""} onClick={() => changeLocale("fr")} disabled={switchingLocale}>FR</button>
            </div>

            <div className={styles.accountWrap} ref={accountRef}>
              <button type="button" className={styles.accountButton} onClick={() => setAccountOpen(value => !value)} aria-expanded={accountOpen}>
                {photoUrl ? <img src={photoUrl} alt=""/> : <span>{initials(name)}</span>}
                <div><strong>{name}</strong><small>{workspaceLabel}</small></div>
                <ChevronDown size={14}/>
              </button>
              {accountOpen ? <div className={styles.accountMenu}>
                <div className={styles.accountMenuHead}>
                  <strong>{name}</strong>
                  <span>{email}</span>
                </div>
                <div className={styles.accountMenuSection}>
                  <span>{l("Workspaces", "Espaces")}</span>
                  <Link href="/professional" className={styles.currentWorkspace}><BriefcaseBusiness size={15}/><div><strong>{l("Professional", "Professionnel")}</strong><small>{l("Accountant workspace", "Espace comptable")}</small></div><Check size={14}/></Link>
                  <Link href={hasBusinessWorkspace ? "/app" : "/setup"}><Building2 size={15}/><div><strong>{hasBusinessWorkspace ? l("Business", "Entreprise") : l("Create business workspace", "Créer un espace entreprise")}</strong><small>{hasBusinessWorkspace ? l("Switch workspace", "Changer d’espace") : l("Use the same Zuelen login", "Utiliser le même compte Zuelen")}</small></div></Link>
                </div>
                <div className={styles.accountMenuSection}>
                  <Link href="/professional/settings"><Settings size={15}/><div><strong>{l("Settings", "Paramètres")}</strong><small>{l("Language, notifications and account", "Langue, notifications et compte")}</small></div></Link>
                  <form action="/auth/signout" method="post"><button type="submit"><LogOut size={15}/><span>{l("Sign out", "Se déconnecter")}</span></button></form>
                </div>
              </div> : null}
            </div>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  );
}
