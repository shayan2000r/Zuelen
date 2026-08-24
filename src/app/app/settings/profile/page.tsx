import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { UserProfileForm } from "@/components/user-profile-form";
import { PageHeader, V2Page } from "@/components/zuelen-ui-v2";
import { localizedRole, normalizeLocale, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./profile.module.css";

export const dynamic="force-dynamic";

export default async function ProfileSettingsPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.userId)redirect("/sign-in");
 const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",supabase=await createClient();
 const avatar=workspace.profile?.avatar_path?await supabase.storage.from("user-avatars").createSignedUrl(workspace.profile.avatar_path,60*60):{data:null,error:null};
 return <V2Page className={styles.page}><PageHeader eyebrow={t(locale,"personalSettings")} title={t(locale,"myProfile")} description={fr?"Gérez votre identité personnelle dans Zuelen. Votre nom, votre adresse e-mail, votre langue et votre photo de profil restent distincts du profil de l’entreprise.":"Manage your personal identity in Zuelen. Your name, email, language and profile image remain separate from the company profile."} actions={[{label:t(locale,"settings"),href:"/app/settings",icon:ArrowLeft,variant:"ghost"}]}/><UserProfileForm email={workspace.email??""} fullName={workspace.profile?.full_name??""} avatarUrl={avatar.data?.signedUrl??null} role={localizedRole(locale,workspace.role)} locale={locale}/></V2Page>;
}
