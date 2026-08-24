import Link from "next/link";
import { ArrowRight, Building2, UserRound, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandImageUploader } from "@/components/brand-image-uploader";
import { PageHeader, V2Page } from "@/components/zuelen-ui-v2";
import { CompanySettingsForm } from "@/components/company-settings-form";
import { localizedRole, normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { canManageOrganization } from "@/lib/permissions";
import styles from "./settings.module.css";

export const dynamic="force-dynamic";
function address(raw:Record<string,unknown>,key:string){const value=raw?.[key];return typeof value==="string"&&value?value:"—"}
export default async function SettingsPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company||!workspace.organization)redirect("/setup");const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",supabase=await createClient(),canManage=canManageOrganization(workspace.role);
 const brand=workspace.company.brand_image_path?await supabase.storage.from("company-documents").createSignedUrl(workspace.company.brand_image_path,60*60):{data:null,error:null};
 return <V2Page className={styles.page}><PageHeader eyebrow={fr?"Profil et paramètres":"Profile & settings"} title={fr?"Paramètres":"Settings"} description={fr?"Gérez votre compte personnel, les accès de l’équipe et le profil de l’entreprise selon votre rôle dans l’organisation.":"Manage your personal account, team access and the company profile according to your organization role."}/>
 <div className={styles.settingsLinks}><Link href="/app/settings/profile" className={styles.teamLink}><span><UserRound size={18}/></span><div><strong>{fr?"Mon profil":"My Profile"}</strong><p>{fr?"Votre nom, votre e-mail et votre photo de profil personnelle.":"Your name, email and personal profile image."}</p></div><ArrowRight size={16}/></Link><Link href="/app/settings/team" className={styles.teamLink}><span><UsersRound size={18}/></span><div><strong>{fr?"Équipe et accès":"Team & Access"}</strong><p>{fr?(canManage?"Consultez les membres et rôles, invitez des personnes et gérez les accès.":"Consultez les membres et rôles de cette organisation."):(`See members and roles${canManage?", invite people and manage access":" in this organization"}.`)}</p></div><ArrowRight size={16}/></Link></div>
 {canManage?<><BrandImageUploader organizationId={workspace.organization.id} companyId={workspace.company.id} currentPath={workspace.company.brand_image_path} currentUrl={brand.data?.signedUrl??null} companyName={workspace.company.trading_name||workspace.company.legal_name}/><CompanySettingsForm company={workspace.company}/></>:<section className={styles.readOnlyCompany}><div className={styles.readOnlyHead}><span><Building2 size={18}/></span><div><p>{fr?"Profil de l’entreprise":"Company profile"}</p><h2>{workspace.company.trading_name||workspace.company.legal_name}</h2></div><em>{localizedRole(locale,workspace.role)} · {fr?"lecture seule":"read only"}</em></div><div className={styles.readOnlyGrid}><div><span>{fr?"Dénomination légale":"Legal name"}</span><strong>{workspace.company.legal_name}</strong></div><div><span>{fr?"Forme juridique":"Legal form"}</span><strong>{workspace.company.legal_form}</strong></div><div><span>{fr?"Numéro RCS":"RCS number"}</span><strong>{workspace.company.rcs_number||"—"}</strong></div><div><span>{fr?"Numéro TVA":"VAT number"}</span><strong>{workspace.company.vat_number||"—"}</strong></div><div><span>{fr?"Siège social":"Registered office"}</span><strong>{address(workspace.company.registered_address,"street")}, {address(workspace.company.registered_address,"postal_code")} {address(workspace.company.registered_address,"city")}</strong></div><div><span>{fr?"Devise de base":"Base currency"}</span><strong>{workspace.company.base_currency}</strong></div></div><p className={styles.readOnlyNote}>{fr?"Seul un Propriétaire ou un Administrateur peut modifier l’identité de l’entreprise, les informations légales et fiscales ainsi que l’image de marque.":"Only an Owner or Admin can change company identity, legal details, tax profile and branding."}</p></section>}
 </V2Page>;
}
