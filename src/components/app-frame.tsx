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
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { setLocalePreference } from "@/app/app/locale-actions";
import { LocaleProvider } from "@/components/locale-context";
import { RoleProvider } from "@/components/role-context";
import type { OrganizationRole } from "@/lib/permissions";
import {
  localizedRole,
  t,
  type AccountTranslation,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";
import styles from "./live.module.css";
import frame from "./app-frame.module.css";
import "./topbar-polish.module.css";

type NavItem = { label: string; description: string; icon: LucideIcon; href: string };
type CollapsibleGroup = { key: "accounting" | "insights"; label: string; icon: LucideIcon; items: NavItem[] };
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
};

function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")}

export function AppFrame(props: AppFrameProps) {
  return (
    <LocaleProvider locale={props.locale} accountTranslations={props.accountTranslations}>
      <AppFrameInner {...props} />
    </LocaleProvider>
  );
}

function AppFrameInner({children,companyName,fiscalYear,fiscalYears,email,userName,userRole,userAvatarUrl,attentionCount=0,brandImageUrl=null,locale}:AppFrameProps){
 const pathname=usePathname(),[mobileNav,setMobileNav]=useState(false),[searchOpen,setSearchOpen]=useState(false),[notificationsOpen,setNotificationsOpen]=useState(false),[query,setQuery]=useState(""),[theme,setTheme]=useState<Theme>("light"),[switchingYear,setSwitchingYear]=useState(false),[switchingLocale,startLocaleTransition]=useTransition();
 const tx=(key:MessageKey)=>t(locale,key);
 const primaryItems=useMemo<NavItem[]>(()=>[
  { label:tx("overview"),description:tx("companySnapshot"),icon:LayoutDashboard,href:"/app" },
  { label:tx("transactions"),description:tx("reviewPostActivity"),icon:WalletCards,href:"/app/transactions" },
  { label:tx("banking"),description:tx("statementsReconciliation"),icon:Landmark,href:"/app/banking" },
  { label:tx("invoices"),description:tx("salesReceivables"),icon:ReceiptText,href:"/app/invoices" },
  { label:tx("documents"),description:tx("companyDocumentVault"),icon:FileText,href:"/app/documents" },
 ],[locale]);
 const collapsibleGroups=useMemo<CollapsibleGroup[]>(()=>[
  {key:"accounting",label:tx("accountingTax"),icon:BookOpen,items:[
   {label:tx("accounting"),description:tx("doubleEntryJournal"),icon:BookOpen,href:"/app/accounting"},
   {label:tx("vatFiling"),description:tx("vatReadiness"),icon:FileOutput,href:"/app/vat"},
   {label:tx("taxes"),description:tx("estimatesReservesNotices"),icon:Landmark,href:"/app/taxes"},
   {label:tx("yearEnd"),description:tx("closingChecklist"),icon:CalendarCheck2,href:"/app/year-end"},
   {label:tx("annualAccounts"),description:tx("ecdfPreparation"),icon:FileCode2,href:"/app/ecdf"},
   {label:tx("compliance"),description:tx("deadlinesObligations"),icon:FileCheck2,href:"/app/compliance"},
  ]},
  {key:"insights",label:tx("insightsAi"),icon:BarChart3,items:[
   {label:tx("reports"),description:tx("financialAnalyticsStatements"),icon:BarChart3,href:"/app/reports"},
   {label:tx("copilot"),description:tx("askYourBooks"),icon:Sparkles,href:"/app/copilot"},
  ]},
 ],[locale]);
 const settingsItem=useMemo<NavItem>(()=>({label:tx("settings"),description:tx("companyProfilePreferences"),icon:Settings,href:"/app/settings"}),[locale]);
 const allItems=useMemo(()=>[...primaryItems,...collapsibleGroups.flatMap(group=>group.items),settingsItem],[primaryItems,collapsibleGroups,settingsItem]);
 const[openGroups,setOpenGroups]=useState<Record<CollapsibleGroup["key"],boolean>>({accounting:pathname.startsWith("/app/accounting")||pathname.startsWith("/app/vat")||pathname.startsWith("/app/taxes")||pathname.startsWith("/app/year-end")||pathname.startsWith("/app/ecdf")||pathname.startsWith("/app/compliance"),insights:pathname.startsWith("/app/reports")||pathname.startsWith("/app/copilot")});
 const userLabel=useMemo(()=>userName?.trim()||email?.split("@")[0]||tx("member"),[userName,email,locale]),roleLabel=localizedRole(locale,userRole);
 const results=useMemo(()=>{const normalized=query.trim().toLowerCase();return normalized?allItems.filter(item=>`${item.label} ${item.description}`.toLowerCase().includes(normalized)):allItems.slice(0,8)},[query,allItems]);
 useEffect(()=>{const stored=window.localStorage.getItem("zuelen-theme"),initialTheme:Theme=stored==="dark"?"dark":"light";setTheme(initialTheme);document.documentElement.dataset.zuelenTheme=initialTheme},[]);
 function applyTheme(next:Theme){setTheme(next);window.localStorage.setItem("zuelen-theme",next);document.documentElement.dataset.zuelenTheme=next}
 function changeFiscalYear(next:number){if(!Number.isInteger(next)||next===fiscalYear)return;setSwitchingYear(true);document.cookie=`zuelen-fiscal-year=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;window.location.reload()}
 function changeLocale(next:Locale){if(next===locale||switchingLocale)return;startLocaleTransition(async()=>{await setLocalePreference(next);window.location.reload()})}
 useEffect(()=>{for(const group of collapsibleGroups)if(group.items.some(item=>pathname.startsWith(item.href)))setOpenGroups(current=>({...current,[group.key]:true}))},[pathname,collapsibleGroups]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setSearchOpen(true)}if(event.key==="Escape"){setSearchOpen(false);setNotificationsOpen(false)}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[]);
 const navLink=(item:NavItem,nested=false)=>{const active=item.href==="/app"?pathname==="/app":pathname.startsWith(item.href);return <Link key={item.href} href={item.href} className={`nav-item ${active?"nav-active":""} ${nested?frame.nestedNavItem:""}`} onClick={()=>setMobileNav(false)}><item.icon size={nested?14:16}/><span>{item.label}</span>{item.href==="/app/transactions"&&attentionCount>0?<em>{attentionCount}</em>:null}</Link>};
 const companyAvatar=(className:string)=>brandImageUrl?<span className={`${className} ${frame.imageAvatar}`}><img src={brandImageUrl} alt=""/></span>:<span className={className}>{initials(companyName).slice(0,1)||"C"}</span>;
 const personalAvatar=(className:string)=>userAvatarUrl?<span className={`${className} ${frame.imageAvatar}`}><img src={userAvatarUrl} alt=""/></span>:<span className={className}>{initials(userLabel)||<UserRound size={16}/>}</span>;
 return <RoleProvider role={userRole}><main className="app-shell" data-role={userRole??"member"} data-locale={locale}><aside className={`sidebar ${mobileNav?"sidebar-open":""}`}>
  <div className="brand-row"><Link href="/app" className={styles.brandLink}><div className="brand-mark"><span>Z</span></div><div className="brand-word">Zuelen</div><span className={frame.brandBadge}>LU</span></Link><button className="icon-btn mobile-only" onClick={()=>setMobileNav(false)} aria-label={tx("closeNavigation")}><X size={18}/></button></div>
  <div className={`company-switcher ${frame.yearSwitcher}`}>{companyAvatar("company-avatar")}<span className={`company-copy ${frame.yearCopy}`}><strong>{companyName}</strong><span className={frame.yearSelectWrap}><span className={frame.yearHint}>{tx("financialYear")}</span><select className={frame.yearSelect} value={fiscalYear} disabled={switchingYear} onChange={event=>changeFiscalYear(Number(event.target.value))} aria-label={tx("financialYear")}>{fiscalYears.map(year=><option key={year} value={year}>{year}</option>)}</select><ChevronDown size={11}/></span></span></div>
  <nav className="nav-list" aria-label={locale==="fr"?"Navigation principale":"Primary navigation"}><div className={frame.primaryNav}>{primaryItems.map(item=>navLink(item))}</div><div className={frame.groupDivider}/>{collapsibleGroups.map(group=>{const isOpen=openGroups[group.key],hasActiveChild=group.items.some(item=>pathname.startsWith(item.href));return <div className={frame.navGroup} key={group.key}><button type="button" className={`${frame.groupButton} ${hasActiveChild?frame.groupButtonActive:""}`} onClick={()=>setOpenGroups(current=>({...current,[group.key]:!current[group.key]}))} aria-expanded={isOpen}><group.icon size={16}/><span>{group.label}</span><ChevronDown className={isOpen?frame.chevronOpen:""} size={14}/></button><div className={`${frame.groupChildren} ${isOpen?frame.groupChildrenOpen:""}`}><div>{group.items.map(item=>navLink(item,true))}</div></div></div>})}<div className={frame.groupDivider}/>{navLink(settingsItem)}</nav>
  <div className="sidebar-spacer"/>
  <div className={frame.themeRow}><span>{tx("language")}</span><div className={frame.themeToggle} role="group" aria-label={tx("language")}><button type="button" className={locale==="en"?frame.themeActive:""} onClick={()=>changeLocale("en")} disabled={switchingLocale} aria-label={tx("english")}>EN</button><button type="button" className={locale==="fr"?frame.themeActive:""} onClick={()=>changeLocale("fr")} disabled={switchingLocale} aria-label={tx("french")}>FR</button></div></div>
  <div className={frame.themeRow}><span>{tx("appearance")}</span><div className={frame.themeToggle} role="group" aria-label={tx("appearance")}><button type="button" className={theme==="light"?frame.themeActive:""} onClick={()=>applyTheme("light")} aria-label={tx("lightMode")}><Sun size={14}/></button><button type="button" className={theme==="dark"?frame.themeActive:""} onClick={()=>applyTheme("dark")} aria-label={tx("darkMode")}><Moon size={14}/></button></div></div>
  <div className="user-row"><Link href="/app/settings/profile" className={frame.userProfileLink}>{personalAvatar("user-avatar")}<span><strong>{userLabel}</strong><small>{roleLabel} · {tx("myProfile")}</small></span></Link><form action="/auth/signout" method="post" className={styles.signOutForm}><button type="submit" className={styles.signOutButton} aria-label={tx("signOut")} title={tx("signOut")}><LogOut size={15}/></button></form></div>
 </aside>{mobileNav?<button className="scrim" aria-label={tx("closeNavigation")} onClick={()=>setMobileNav(false)}/>:null}
 <section className="workspace"><header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-only" onClick={()=>setMobileNav(true)} aria-label={tx("openNavigation")}><Menu size={18}/></button></div><div className="topbar-actions"><button className="search-btn" type="button" onClick={()=>setSearchOpen(true)} aria-label={tx("searchZuelen")} title={`${tx("searchZuelen")} (⌘K)`}><Search size={17}/></button><div className={frame.notificationWrap}><button className="icon-btn" type="button" aria-label={tx("notifications")} aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(value=>!value)}><Bell size={17}/>{attentionCount>0?<span className="notification-dot"/>:null}</button>{notificationsOpen?<div className={frame.notificationPanel}><div><strong>{tx("notifications")}</strong><button onClick={()=>setNotificationsOpen(false)} aria-label={tx("closeNotifications")}><X size={14}/></button></div>{attentionCount?<Link href="/app/transactions" onClick={()=>setNotificationsOpen(false)}><span className={frame.noticeIcon}><WalletCards size={15}/></span><span><strong>{locale==="fr"?`${attentionCount} transaction${attentionCount===1?"":"s"} à vérifier`:`${attentionCount} transaction${attentionCount===1?"":"s"} need review`}</strong><small>{locale==="fr"?`Ouvrir la vérification des transactions pour ${fiscalYear}`:`Open transaction review for ${fiscalYear}`}</small></span></Link>:<p>{locale==="fr"?`Tout est à jour pour ${fiscalYear}.`:`You’re all caught up for ${fiscalYear}.`}</p>}<Link href="/app/compliance" onClick={()=>setNotificationsOpen(false)}><span className={frame.noticeIcon}><CalendarCheck2 size={15}/></span><span><strong>{tx("complianceCenter")}</strong><small>{locale==="fr"?`Vérifier les obligations ${fiscalYear}`:`Review ${fiscalYear} obligations`}</small></span></Link></div>:null}</div><Link className={`icon-btn ${frame.profileButton}`} href="/app/settings/profile" aria-label={`${tx("myProfile")}: ${userLabel}`} title={tx("myProfile")}>{userAvatarUrl?<span className={frame.topAvatar}><img src={userAvatarUrl} alt=""/></span>:<UserRound size={17}/>}</Link></div></header>{children}</section>
 {searchOpen?<div className={frame.searchOverlay} role="dialog" aria-modal="true" aria-label={tx("searchZuelen")} onMouseDown={event=>{if(event.currentTarget===event.target)setSearchOpen(false)}}><div className={frame.searchDialog}><div className={frame.searchInput}><Search size={18}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder={tx("searchPlaceholder")}/><button onClick={()=>setSearchOpen(false)}><kbd>ESC</kbd></button></div><div className={frame.searchResults}><p>{query?tx("results"):tx("quickNavigation")}</p>{results.map(item=><Link href={item.href} key={item.href} onClick={()=>setSearchOpen(false)}><span><item.icon size={17}/></span><div><strong>{item.label}</strong><small>{item.description}</small></div></Link>)}{results.length===0?<div className={frame.noResults}>{tx("noMatchingWorkspace")}</div>:null}</div></div></div>:null}
 </main></RoleProvider>;
}
