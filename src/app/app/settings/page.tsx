import Link from "next/link";
import { ArrowRight, Building2, UserRound, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandImageUploader } from "@/components/brand-image-uploader";
import { CompanySettingsForm } from "@/components/company-settings-form";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { canManageOrganization, prettyRole } from "@/lib/permissions";
import styles from "./settings.module.css";

export const dynamic="force-dynamic";
function address(raw:Record<string,unknown>,key:string){const value=raw?.[key];return typeof value==="string"&&value?value:"—"}
export default async function SettingsPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company||!workspace.organization)redirect("/setup");const supabase=await createClient(),canManage=canManageOrganization(workspace.role);
 const brand=workspace.company.brand_image_path?await supabase.storage.from("company-documents").createSignedUrl(workspace.company.brand_image_path,60*60):{data:null,error:null};
 return <div className={styles.page}><header className={styles.intro}><p>Profile & settings</p><h1>Settings</h1><h2>Manage your personal account, team access and the company profile according to your organization role.</h2></header>
 <div className={styles.settingsLinks}><Link href="/app/settings/profile" className={styles.teamLink}><span><UserRound size={18}/></span><div><strong>My Profile</strong><p>Your name, email and personal profile image.</p></div><ArrowRight size={16}/></Link><Link href="/app/settings/team" className={styles.teamLink}><span><UsersRound size={18}/></span><div><strong>Team & Access</strong><p>See members and roles{canManage?", invite people and manage access":" in this organization"}.</p></div><ArrowRight size={16}/></Link></div>
 {canManage?<><BrandImageUploader organizationId={workspace.organization.id} companyId={workspace.company.id} currentPath={workspace.company.brand_image_path} currentUrl={brand.data?.signedUrl??null} companyName={workspace.company.trading_name||workspace.company.legal_name}/><CompanySettingsForm company={workspace.company}/></>:<section className={styles.readOnlyCompany}><div className={styles.readOnlyHead}><span><Building2 size={18}/></span><div><p>Company profile</p><h2>{workspace.company.trading_name||workspace.company.legal_name}</h2></div><em>{prettyRole(workspace.role)} · read only</em></div><div className={styles.readOnlyGrid}><div><span>Legal name</span><strong>{workspace.company.legal_name}</strong></div><div><span>Legal form</span><strong>{workspace.company.legal_form}</strong></div><div><span>RCS number</span><strong>{workspace.company.rcs_number||"—"}</strong></div><div><span>VAT number</span><strong>{workspace.company.vat_number||"—"}</strong></div><div><span>Registered office</span><strong>{address(workspace.company.registered_address,"street")}, {address(workspace.company.registered_address,"postal_code")} {address(workspace.company.registered_address,"city")}</strong></div><div><span>Base currency</span><strong>{workspace.company.base_currency}</strong></div></div><p className={styles.readOnlyNote}>Only an Owner or Admin can change company identity, legal details, tax profile and branding.</p></section>}
 </div>;
}
