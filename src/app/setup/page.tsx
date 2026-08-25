import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, Building2, Plus, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { normalizeLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";
import styles from "./setup.module.css";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const params = await searchParams;
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  const additive = params.add === "1";
  if (!additive && workspace.company) redirect("/app");
  if (!additive && workspace.workspaces.length > 1) redirect("/contexts");
  const fr = normalizeLocale(workspace.profile?.locale) === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const cards = [
    { icon:UserRound, title:l("Independent", "Indépendant"), description:l("Manage an activity you operate in your own name.", "Gérez une activité exercée en votre nom propre."), examples:l("Freelancer · Sole trader · Consultant · Liberal profession", "Freelance · Entreprise individuelle · Consultant · Profession libérale"), detail:l("For people who invoice or run a professional activity personally rather than through a separate company.", "Pour les personnes qui facturent ou exercent personnellement une activité professionnelle, sans société distincte."), cta:l("Set up independent activity", "Configurer une activité indépendante"), href:"/setup/independent" },
    { icon:Building2, title:l("Company", "Société"), description:l("Manage the accounting and obligations of a Luxembourg company.", "Gérez la comptabilité et les obligations d’une société luxembourgeoise."), examples:"SARL · SARL-S · SA · SAS · SCA", detail:l("For incorporated businesses with their own legal entity.", "Pour les entreprises constituées avec leur propre personnalité juridique."), cta:l("Set up company", "Configurer une société"), href:"/setup/company" },
    { icon:BriefcaseBusiness, title:l("Accounting professional", "Professionnel de la comptabilité"), description:l("Create your professional presence and manage accounting-client workflows.", "Créez votre présence professionnelle et gérez vos parcours clients comptables."), examples:l("Accountant · Expert-comptable · Fiduciary · Accounting firm", "Comptable · Expert-comptable · Fiduciaire · Cabinet comptable"), detail:l("Your professional persona stays separate from the activities whose books you manage.", "Votre profil professionnel reste distinct des activités dont vous gérez la comptabilité."), cta:l("Set up professional profile", "Configurer le profil professionnel"), href:"/professional" },
  ];
  return <main className={styles.shell}><header className={styles.topbar}><Link href="/" className={styles.brand}><Image src="/zuelen-icon.png" alt="" width={28} height={28}/><strong>Zuelen</strong></Link>{additive ? <Link href={workspace.company ? "/app" : "/contexts"} className={styles.close}>{l("Back to my workspaces", "Retour à mes espaces")}</Link> : <span>{l("One account · every activity", "Un compte · toutes vos activités")}</span>}</header><section className={styles.intro}><span><Plus size={14}/>{additive ? l("Add another activity", "Ajouter une autre activité") : l("Workspace setup", "Configuration de l’espace")}</span><h1>{additive ? l("What would you like to add?", "Que souhaitez-vous ajouter ?") : l("What would you like to set up?", "Que souhaitez-vous configurer ?")}</h1><p>{l("Choose what best describes how you'll use Zuelen. You can add another activity later.", "Choisissez ce qui décrit le mieux votre utilisation de Zuelen. Vous pourrez ajouter une autre activité plus tard.")}</p></section><section className={styles.grid} aria-label={l("Setup options", "Options de configuration")}>{cards.map(card => <article className={styles.card} key={card.href}><div className={styles.icon}><card.icon size={23}/></div><h2>{card.title}</h2><p>{card.description}</p><strong className={styles.examples}>{card.examples}</strong><small>{card.detail}</small><Link href={card.href}>{card.cta}<span aria-hidden="true">→</span></Link></article>)}</section><p className={styles.footer}>{l("Your choice is not permanent. One secure Zuelen login can hold several activities and a professional profile.", "Votre choix n’est pas définitif. Un même compte Zuelen sécurisé peut contenir plusieurs activités et un profil professionnel.")}</p></main>;
}
