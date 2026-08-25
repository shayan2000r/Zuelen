import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, Building2, Check, Plus, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { switchWorkspaceAction } from "@/app/workspace-actions";
import { normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./contexts.module.css";

export const dynamic = "force-dynamic";

export default async function ContextsPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in");
  const supabase = await createClient();
  const { data: professional } = await supabase.from("accountant_profiles").select("id,full_name,firm_name").eq("user_id", workspace.userId).maybeSingle();
  if (!workspace.workspaces.length && !professional) redirect("/setup");
  const fr = normalizeLocale(workspace.profile?.locale) === "fr";
  const l = (en:string,french:string) => fr ? french : en;
  return <main className={styles.shell}><header><Link href="/"><Image src="/zuelen-icon.png" alt="" width={28} height={28}/><strong>Zuelen</strong></Link><Link href="/setup?add=1"><Plus size={14}/>{l("Add another activity","Ajouter une autre activité")}</Link></header><section className={styles.intro}><span>{l("Your Zuelen contexts","Vos contextes Zuelen")}</span><h1>{l("Choose where to continue.","Choisissez où continuer.")}</h1><p>{l("Each economic workspace keeps its own books and permissions. Your professional profile remains a separate experience.","Chaque espace économique conserve sa propre comptabilité et ses autorisations. Votre profil professionnel reste une expérience distincte.")}</p></section><section className={styles.list}>{workspace.workspaces.map(item=><form action={switchWorkspaceAction} key={item.companyId}><input type="hidden" name="company_id" value={item.companyId}/><input type="hidden" name="return_to" value="/app"/><button type="submit"><span className={styles.icon}>{item.entityKind==="independent"?<UserRound/>:<Building2/>}</span><div><strong>{item.displayName}</strong><small>{item.entityKind==="independent"?l("Independent activity","Activité indépendante"):`${l("Company","Société")} · ${item.legalForm}`}</small></div>{workspace.company?.id===item.companyId?<em><Check size={13}/>{l("Current","Actuel")}</em>:<span aria-hidden="true">→</span>}</button></form>)}{professional?<Link href="/professional" className={styles.professional}><span className={styles.icon}><BriefcaseBusiness/></span><div><strong>{professional.firm_name||professional.full_name}</strong><small>{l("Professional workspace · Accountant","Espace professionnel · Comptable")}</small></div><span aria-hidden="true">→</span></Link>:null}</section></main>;
}
