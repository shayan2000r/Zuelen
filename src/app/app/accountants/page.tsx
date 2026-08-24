import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Languages, MapPin, Search, Sparkles, UserRoundCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { ACCOUNTANT_LANGUAGES, ACCOUNTANT_SPECIALTIES, accountantInitials, accountantLanguageLabel, accountantSpecialtyLabel, type AccountantListingSubscription, type AccountantProfile } from "@/lib/accountants";
import { normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./accountants.module.css";

export const dynamic = "force-dynamic";

type Params = { q?: string; language?: string; specialty?: string; location?: string };

function cleanSearch(value: string | undefined) {
  return (value ?? "").replace(/[,%()]/g, " ").trim().slice(0, 80);
}

export default async function AccountantsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.company) redirect("/sign-in?next=/app/accountants");
  const locale = normalizeLocale(workspace.profile?.locale), fr = locale === "fr";
  const params = await searchParams;
  const q = cleanSearch(params.q), language = cleanSearch(params.language), specialty = cleanSearch(params.specialty), location = cleanSearch(params.location);
  const supabase = await createClient();
  let query = supabase.from("accountant_profiles").select("*").eq("approval_status", "approved").limit(80);
  if (q) query = query.or(`full_name.ilike.%${q}%,firm_name.ilike.%${q}%,professional_title.ilike.%${q}%`);
  if (language) query = query.contains("languages", [language]);
  if (specialty) query = query.contains("specialties", [specialty]);
  if (location) query = query.ilike("location", `%${location}%`);
  const { data: profilesData, error } = await query;
  if (error) throw new Error(error.message);
  const profiles = (profilesData ?? []) as AccountantProfile[];
  let subscriptions: AccountantListingSubscription[] = [];
  if (profiles.length) {
    const result = await supabase.from("accountant_listing_subscriptions").select("*").in("profile_id", profiles.map(profile => profile.id));
    if (result.error) throw new Error(result.error.message);
    subscriptions = (result.data ?? []) as AccountantListingSubscription[];
  }
  const subscriptionMap = new Map(subscriptions.map(subscription => [subscription.profile_id, subscription]));
  const visible = profiles.filter(profile => {
    const subscription = subscriptionMap.get(profile.id);
    if (!subscription) return false;
    if (subscription.status === "active") return true;
    return subscription.status === "trialing" && (!subscription.trial_end || new Date(subscription.trial_end).getTime() > Date.now());
  }).sort((a, b) => {
    const aTier = subscriptionMap.get(a.id)?.tier === "premium" ? 1 : 0;
    const bTier = subscriptionMap.get(b.id)?.tier === "premium" ? 1 : 0;
    return bTier - aTier || a.full_name.localeCompare(b.full_name);
  });

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div><span className={styles.eyebrow}><BriefcaseBusiness size={14}/>{fr ? "Réseau professionnel Zuelen" : "Zuelen professional network"}</span><h1>{fr ? "Trouvez le bon comptable pour votre entreprise." : "Find the right accountant for your business."}</h1><p>{fr ? "Gérez le quotidien dans Zuelen, puis trouvez un professionnel vérifié lorsque vous souhaitez une vérification, un deuxième avis ou un accompagnement continu." : "Handle the day-to-day in Zuelen, then find a verified professional when you want a review, a second opinion or ongoing support."}</p></div>
      <div className={styles.heroProof}><BadgeCheck size={20}/><div><strong>{fr ? "Profils vérifiés" : "Verified profiles"}</strong><span>{fr ? "Chaque profil est vérifié par Zuelen avant publication." : "Every profile is reviewed by Zuelen before publication."}</span></div></div>
    </section>

    <form className={styles.filters} method="get">
      <label className={styles.search}><Search size={16}/><input name="q" defaultValue={q} placeholder={fr ? "Nom, fiduciaire ou titre..." : "Name, firm or title..."}/></label>
      <input name="location" defaultValue={location} placeholder={fr ? "Localisation" : "Location"}/>
      <select name="language" defaultValue={language}><option value="">{fr ? "Toutes les langues" : "All languages"}</option>{ACCOUNTANT_LANGUAGES.map(value => <option value={value} key={value}>{accountantLanguageLabel(value, locale, true)}</option>)}</select>
      <select name="specialty" defaultValue={specialty}><option value="">{fr ? "Toutes les spécialités" : "All specialties"}</option>{ACCOUNTANT_SPECIALTIES.map(value => <option value={value} key={value}>{accountantSpecialtyLabel(value, locale)}</option>)}</select>
      <button type="submit">{fr ? "Rechercher" : "Search"}</button>
      {(q || language || specialty || location) ? <Link href="/app/accountants">{fr ? "Effacer" : "Clear"}</Link> : null}
    </form>

    <div className={styles.resultsBar}><div><strong>{visible.length}</strong><span>{fr ? `professionnel${visible.length === 1 ? "" : "s"}` : `professional${visible.length === 1 ? "" : "s"}`}</span></div><p>{fr ? "Les profils Premium bénéficient d’un placement prioritaire, sans masquer les profils Basic pertinents." : "Premium profiles receive priority placement without hiding relevant Basic profiles."}</p></div>

    {visible.length ? <section className={styles.grid}>{visible.map(profile => {
      const subscription = subscriptionMap.get(profile.id)!;
      const premium = subscription.tier === "premium";
      return <Link href={`/app/accountants/${profile.slug}`} className={`${styles.card} ${premium ? styles.premium : ""}`} key={profile.id}>
        <div className={styles.cardVisual}>
          {premium ? <span className={styles.featured}><Sparkles size={11}/>Premium</span> : <span className={styles.verified}><BadgeCheck size={11}/>{fr ? "Vérifié" : "Verified"}</span>}
          <div className={styles.photoWrap}>{profile.photo_url ? <img src={profile.photo_url} alt=""/> : <span className={styles.avatar}>{accountantInitials(profile.full_name)}</span>}</div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardIdentity}><h2>{profile.full_name}</h2><p>{profile.professional_title}</p>{profile.firm_name ? <small>{profile.firm_name}</small> : null}</div>
          {profile.accepting_new_clients ? <span className={styles.availability}><UserRoundCheck size={13}/>{fr ? "Accepte de nouveaux clients" : "Accepting new clients"}</span> : <span className={styles.availabilityMuted}>{fr ? "Disponibilité limitée" : "Limited availability"}</span>}
          <div className={styles.meta}>{profile.location ? <span><MapPin size={13}/>{profile.location}</span> : null}{profile.languages.length ? <span><Languages size={13}/>{profile.languages.slice(0,3).map(value=>accountantLanguageLabel(value,locale)).join(" · ")}</span> : null}</div>
          {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}
          <div className={styles.tags}>{profile.specialties.slice(0,3).map(item => <span key={item}>{accountantSpecialtyLabel(item, locale)}</span>)}{profile.specialties.length > 3 ? <span>+{profile.specialties.length - 3}</span> : null}</div>
          <div className={styles.cardFoot}><span>{fr ? "Voir le profil" : "View profile"}</span><ArrowRight size={15}/></div>
        </div>
      </Link>;
    })}</section> : <section className={styles.empty}><BriefcaseBusiness size={28}/><h2>{fr ? "Aucun profil ne correspond encore à ces filtres." : "No profiles match these filters yet."}</h2><p>{fr ? "Élargissez votre recherche ou revenez bientôt pendant que nous développons le réseau Zuelen." : "Broaden your search or check back soon as we grow the Zuelen professional network."}</p></section>}

    <section className={styles.join}><div><span>{fr ? "Vous êtes comptable ?" : "Are you an accountant?"}</span><h2>{fr ? "Rencontrez les entreprises qui ont besoin de votre expertise." : "Meet the businesses that need your expertise."}</h2><p>{fr ? "Créez votre profil professionnel. Basic à 19 €/mois ou Premium à 29 €/mois, chacun avec 30 jours d’essai gratuit." : "Create your professional listing. Basic at €19/month or Premium at €29/month, both with a 30-day free trial."}</p></div><Link href="/professional">{fr ? "Référencer mon activité" : "List my practice"}<ArrowRight size={15}/></Link></section>

    <p className={styles.disclaimer}>{fr ? "Les professionnels référencés sur Zuelen exercent de manière indépendante. Zuelen ne fournit pas de conseils comptables, fiscaux ou juridiques et ne garantit pas les prestations des professionnels référencés." : "Professionals listed on Zuelen operate independently. Zuelen does not provide accounting, tax or legal advice and does not guarantee services provided by listed professionals."}</p>
  </div>;
}
