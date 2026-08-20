import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandImageUploader } from "@/components/brand-image-uploader";
import { CompanySettingsForm } from "@/components/company-settings-form";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./settings.module.css";

export const dynamic="force-dynamic";
export default async function SettingsPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company||!workspace.organization)redirect("/setup");const supabase=await createClient();
 const brand=workspace.company.brand_image_path?await supabase.storage.from("company-documents").createSignedUrl(workspace.company.brand_image_path,60*60):{data:null,error:null};
 return <div className={styles.page}><header className={styles.intro}><p>Profile & settings</p><h1>Company settings</h1><h2>Update company information, branding and access to your Compta workspace.</h2></header><Link href="/app/settings/team" className={styles.teamLink}><span><UsersRound size={18}/></span><div><strong>Team & Access</strong><p>Invite colleagues, accountants or bookkeepers and control what they can do.</p></div><ArrowRight size={16}/></Link><BrandImageUploader organizationId={workspace.organization.id} companyId={workspace.company.id} currentPath={workspace.company.brand_image_path} currentUrl={brand.data?.signedUrl??null} companyName={workspace.company.trading_name||workspace.company.legal_name}/><CompanySettingsForm company={workspace.company}/></div>;
}
