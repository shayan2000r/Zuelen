import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { UserProfileForm } from "@/components/user-profile-form";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { prettyRole } from "@/lib/permissions";
import styles from "./profile.module.css";

export const dynamic="force-dynamic";

export default async function ProfileSettingsPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.userId)redirect("/sign-in");
 const supabase=await createClient();
 const avatar=workspace.profile?.avatar_path?await supabase.storage.from("user-avatars").createSignedUrl(workspace.profile.avatar_path,60*60):{data:null,error:null};
 return <main className={styles.page}><Link href="/app/settings" className={styles.back}><ArrowLeft size={13}/>Settings</Link><header className={styles.intro}><p>Personal settings</p><h1>My Profile</h1><h2>Manage your personal identity in Compta. Your name, email and profile image are separate from the company profile and company logo.</h2></header><UserProfileForm email={workspace.email??""} fullName={workspace.profile?.full_name??""} avatarUrl={avatar.data?.signedUrl??null} role={prettyRole(workspace.role)}/></main>;
}
