import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, BriefcaseBusiness, Check, ShieldCheck, Sparkles } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import styles from "./accountants-landing.module.css";

export const dynamic = "force-dynamic";

export default async function AccountantsLandingPage() {
  const workspace = await getWorkspace();
  const professionalHref = workspace.authenticated ? "/professional" : "/sign-in?type=accountant";
  return <main className={styles.page}>
    <header><Link href="/" className={styles.brand}><img src="/zuelen-icon.png" alt=""/><strong>Zuelen</strong><span>for Accountants</span></Link><Link href={professionalHref}>{workspace.authenticated ? "Professional workspace" : "Sign in"}</Link></header>
    <section className={styles.hero}><div><span><BriefcaseBusiness size={14}/>Zuelen professional network</span><h1>Put your practice where Luxembourg businesses already manage their finances.</h1><p>Create a trusted directory profile and receive direct enquiries from business owners looking for accounting expertise.</p><div className={styles.actions}><Link href={professionalHref}>Start your 30-day trial <ArrowRight size={15}/></Link><small>Payment method required · cancel before the trial ends</small></div></div><aside><BadgeCheck size={28}/><strong>Curated, not crowded.</strong><p>Every accountant profile is reviewed before it appears in the directory, helping businesses browse with more confidence.</p></aside></section>
    <section className={styles.plans}><div className={styles.plan}><span>Basic</span><strong>€19<small>/month</small></strong><p>Everything you need for a complete, professional directory presence.</p><ul><li><Check size={14}/>Professional profile</li><li><Check size={14}/>Languages & specialties</li><li><Check size={14}/>Direct contact information</li><li><Check size={14}/>Standard directory placement</li></ul></div><div className={`${styles.plan} ${styles.premium}`}><span><Sparkles size={13}/>Premium</span><strong>€29<small>/month</small></strong><p>For practices that want stronger visibility and measurable lead activity.</p><ul><li><Check size={14}/>Everything in Basic</li><li><Check size={14}/>Featured badge</li><li><Check size={14}/>Priority placement</li><li><BarChart3 size={14}/>Profile & contact analytics</li></ul></div></section>
    <section className={styles.trust}><div><ShieldCheck size={20}/><span><strong>30 days free on both plans</strong><small>Try your selected listing before your first monthly charge.</small></span></div><Link href={professionalHref}>Create my listing <ArrowRight size={14}/></Link></section>
  </main>;
}
