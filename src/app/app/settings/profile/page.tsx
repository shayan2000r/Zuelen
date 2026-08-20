import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { UserProfileForm } from "@/components/user-profile-form";
import { localizedRole, normalizeLocale, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./profile.module.css";

export const dynamic="force-dynamic";

export default async function ProfileSettingsPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.userId)redirect("/sign-in");
 const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",supabase=await createClient();
 const avatar=workspace.profile?.avatar_path?await supabase.storage.from("user-avatars").createSignedUrl(workspace.profile.avatar_path,60*60):{data:null,error:null};
 return <main className={styles.page}><Link href="/app/settings" className={styles.back}><ArrowLeft size={13}/>{t(locale,"settings")}</Link><header className={styles.intro}><p>{t(locale,"personalSettings")}</p><h1>{t(locale,"myProfile")}</h1><h2>{fr?"Gérez votre identité personnelle dans Compta. Votre nom, votre adresse e-mail, votre langue et votre photo de profil sont distincts du profil et du logo de l’entreprise.":"Manage your personal identity in Compta. Your name, email, language and profile image are separate from the company profile and company logo."}</h2></header><UserProfileForm email={workspace.email??""} fullName={workspace.profile?.full_name??""} avatarUrl={avatar.data?.signedUrl??null} role={localizedRole(locale,workspace.role)} locale={locale}/></main>;
}
