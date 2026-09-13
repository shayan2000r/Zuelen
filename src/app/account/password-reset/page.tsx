import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordResetForm } from "@/components/password-reset-form";
import { normalizeLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";
import styles from "@/components/security-settings.module.css";

export const dynamic = "force-dynamic";

export default async function PasswordResetPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  const locale = normalizeLocale(workspace.profile?.locale);
  return <main className={styles.accountShell}><Link className={styles.accountBrand} href="/auth/resolve"><Image src="/zuelen-icon.png" alt="" width={30} height={30}/><strong>Zuelen</strong></Link><PasswordResetForm locale={locale}/></main>;
}
