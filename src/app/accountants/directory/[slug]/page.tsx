import Link from "next/link";
import { ArrowLeft, Award, BadgeCheck, BriefcaseBusiness, CheckCircle2, ExternalLink, Languages, MapPin, MonitorSmartphone, Sparkles, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AccountantEngagement } from "@/components/accountant-engagement";
import { ProfessionalFrame } from "@/components/professional-frame";
import { accountantBusinessTypeLabel, accountantInitials, accountantLanguageLabel, accountantSpecialtyLabel, type AccountantListingSubscription, type AccountantProfile } from "@/lib/accountants";
import { normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "../../../app/accountants/[slug]/profile.module.css";
import polish from "./profile-polish.module.css";

export const dynamic = "force-dynamic";

export default async function StandaloneAccountantProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in?next=/accountants/directory");
  const locale = normalizeLocale(workspace.profile?.locale), fr = locale === "fr";
  const { slug } = await params;
  const supabase = await createClient();

  let ownProfile: AccountantProfile | null = null;
  let ownSubscription: AccountantListingSubscription | null = null;
  if (workspace.userId) {
    const ownResult = await supabase.from("accountant_profiles").select("*").eq("user_id", workspace.userId).maybeSingle();
    if (ownResult.error) throw new Error(ownResult.error.message);
    ownProfile = ownResult.data as AccountantProfile | null;
    if (ownProfile) {
      const ownSubResult = await supabase.from("accountant_listing_subscriptions").select("*").eq("profile_id", ownProfile.id).maybeSingle();
      if (ownSubResult.error) throw new Error(ownSubResult.error.message);
      ownSubscription = ownSubResult.data as AccountantListingSubscription | null;
    }
  }

  const { data, error } = await supabase.from("accountant_profiles").select("*").eq("slug", slug).eq("approval_status", "approved").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const profile = data as AccountantProfile;
  const { data: subscriptionData, error: subError } = await supabase.from("accountant_listing_subscriptions").select("*").eq("profile_id", profile.id).maybeSingle();
  if (subError) throw new Error(subError.message);
  const subscription = subscriptionData as AccountantListingSubscription | null;
  const visible = subscription && (subscription.status === "active" || (subscription.status === "trialing" && (!subscription.trial_end || new Date(subscription.trial_end).getTime() > Date.now())));
  if (!visible) notFound();
  const premium = subscription.tier === "premium";

  const content = <div className={styles.page}>
    <Link href="/accountants/directory" className={styles.back}><ArrowLeft size={14}/>{fr ? "Tous les comptables" : "All accountants"}</Link>
    <section className={`${styles.profileCard} ${polish.hero} ${premium ? styles.premium : ""}`}>
      <div className={`${styles.identity} ${polish.identity}`}>
        {profile.photo_url ? <img src={profile.photo_url} alt=""/> : <span className={styles.avatar}>{accountantInitials(profile.full_name)}</span>}
        <div>{premium ? <div className={`${styles.featured} ${polish.featured}`}><Sparkles size={13}/>{fr?"Professionnel mis en avant":"Featured professional"}</div> : null}<div className={styles.nameLine}><h1>{profile.full_name}</h1><BadgeCheck size={19}/></div><p>{profile.professional_title}</p>{profile.firm_name ? <strong>{profile.firm_name}</strong> : null}<div className={styles.meta}>{profile.location ? <span><MapPin size={13}/>{profile.location}</span> : null}{profile.languages.length ? <span><Languages size={13}/>{profile.languages.map(value=>accountantLanguageLabel(value,locale)).join(" · ")}</span> : null}{profile.years_experience !== null ? <span><Award size={13}/>{profile.years_experience} {fr?"ans d’expérience":"years experience"}</span> : null}</div></div>
      </div>
      <div className={`${styles.contactPanel} ${polish.contact}`}><span>{fr ? "Contacter ce professionnel" : "Contact this professional"}</span><h2>{profile.accepting_new_clients ? (fr ? "Accepte de nouveaux clients" : "Accepting new clients") : (fr ? "Disponibilité limitée" : "Limited availability")}</h2><AccountantEngagement profileId={profile.id} email={profile.email} phone={profile.phone} website={profile.website}/>{profile.portfolio_url ? <a href={profile.portfolio_url} target="_blank" rel="noreferrer" className={polish.portfolio}><ExternalLink size={13}/>{fr?"Profil professionnel / portfolio":"Professional profile / portfolio"}</a>:null}</div>
    </section>

    <section className={styles.contentGrid}>
      <article className={styles.main}>
        <div className={styles.block}><span className={styles.label}>{fr ? "À propos" : "About"}</span><h2>{fr ? "À propos de ce professionnel" : "About this professional"}</h2><p>{profile.bio || (fr ? "Aucune biographie n’a encore été ajoutée." : "No biography has been added yet.")}</p></div>
        <div className={styles.block}><span className={styles.label}>Expertise</span><h2>{fr ? "Spécialités" : "Specialties"}</h2><div className={styles.tags}>{profile.specialties.map(item => <span key={item}>{accountantSpecialtyLabel(item,locale)}</span>)}</div></div>
        <div className={styles.block}><span className={styles.label}>{fr ? "Clientèle" : "Clients"}</span><h2>{fr ? "Types d’entreprises accompagnées" : "Businesses they work with"}</h2><div className={styles.tags}>{profile.business_types.length ? profile.business_types.map(item => <span key={item}>{accountantBusinessTypeLabel(item,locale)}</span>) : <span>{fr ? "PME et indépendants" : "SMEs and independent businesses"}</span>}</div></div>
        {profile.qualifications ? <div className={styles.block}><span className={styles.label}>{fr?"Qualifications":"Qualifications"}</span><h2>{fr?"Parcours et qualifications":"Professional qualifications"}</h2><p>{profile.qualifications}</p></div> : null}
        {profile.client_references ? <div className={styles.block}><span className={styles.label}>{fr?"Références":"References"}</span><h2>{fr?"Références clients":"Client references"}</h2><p>{profile.client_references}</p></div> : null}
      </article>

      <aside className={styles.side}><div className={styles.infoCard}><h3>{fr ? "Mode de travail" : "How they work"}</h3>{profile.works_remotely ? <div><MonitorSmartphone size={16}/><span><strong>{fr ? "À distance" : "Remote"}</strong><small>{fr ? "Collaboration possible à distance" : "Can work with clients remotely"}</small></span></div> : null}{profile.works_in_person ? <div><UsersRound size={16}/><span><strong>{fr ? "En personne" : "In person"}</strong><small>{fr ? "Rendez-vous possibles au Luxembourg" : "In-person meetings available"}</small></span></div> : null}{profile.accepting_new_clients ? <div><CheckCircle2 size={16}/><span><strong>{fr ? "Nouveaux clients" : "New clients"}</strong><small>{fr ? "Accepte actuellement les demandes" : "Currently open to enquiries"}</small></span></div> : null}</div>
      <div className={styles.trustCard}><BadgeCheck size={20}/><div><strong>{fr ? "Profil approuvé par Zuelen" : "Profile approved by Zuelen"}</strong><p>{fr ? "L’identité et les informations du profil ont été examinées avant publication. Cette approbation ne constitue pas une garantie de prestation." : "The identity and listing information were reviewed before publication. Approval is not a guarantee of professional services."}</p></div></div></aside>
    </section>

    <section className={styles.help}><BriefcaseBusiness size={20}/><div><strong>{fr ? "Besoin d’un autre profil ?" : "Need a different fit?"}</strong><span>{fr ? "Comparez d’autres professionnels selon la langue, la localisation et la spécialité." : "Compare other professionals by language, location and specialty."}</span></div><Link href="/accountants/directory">{fr ? "Parcourir l’annuaire" : "Browse directory"}</Link></section>
    <p className={styles.disclaimer}>{fr ? "Les professionnels référencés sur Zuelen exercent de manière indépendante. Zuelen ne fournit pas de conseils comptables, fiscaux ou juridiques et ne garantit pas leurs prestations." : "Professionals listed on Zuelen operate independently. Zuelen does not provide accounting, tax or legal advice and does not guarantee their services."}</p>
  </div>;

  if (ownProfile) {
    return <ProfessionalFrame
      name={ownProfile.full_name || workspace.profile?.full_name || workspace.email || "Accountant"}
      firmName={ownProfile.firm_name}
      email={workspace.email}
      photoUrl={ownProfile.photo_url}
      approvalStatus={ownProfile.approval_status}
      plan={ownSubscription?.tier ?? null}
      hasBusinessWorkspace={workspace.workspaces.length > 0}
      locale={locale}
    >{content}</ProfessionalFrame>;
  }

  return <main style={{minHeight:"100vh",background:"#f7f7f4",paddingTop:24}}>{content}</main>;
}
