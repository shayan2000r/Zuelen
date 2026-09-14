import { LockKeyhole, ShieldCheck } from "lucide-react";
import { AdminPasswordSettings } from "@/components/admin-password-settings";
import { MfaSettings } from "@/components/mfa-settings";
import { requireZuelenAdmin } from "@/lib/admin";
import styles from "./settings.module.css";

export const dynamic="force-dynamic";

export default async function AdminSettingsPage(){
  const { email }=await requireZuelenAdmin("/admin/settings");
  return <main className={styles.shell}>
    <div className={styles.page}>
      <section className={styles.hero}>
        <div><span>Admin security</span><h1>Settings.</h1><p>Manage the credentials and second-factor protection for the isolated Zuelen administrator identity.</p></div>
        <div className={styles.lock}><LockKeyhole size={17}/><div><strong>{email}</strong><span>Only authorized admin identity</span></div></div>
      </section>

      <div className={styles.stack}>
        <AdminPasswordSettings email={email}/>
        <MfaSettings locale="en"/>
      </div>

      <div className={styles.note}><ShieldCheck size={15}/><p>Admin routes are server-protected by exact authenticated email match. Other Zuelen users receive no admin navigation and cannot access /admin pages even if they know the URL.</p></div>
    </div>
  </main>;
}
