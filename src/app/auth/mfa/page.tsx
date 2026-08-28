import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaChallenge } from "@/components/mfa-challenge";
import { normalizeLocale } from "@/lib/i18n";
import { safeInternalDestination } from "@/lib/safe-navigation";
import { getWorkspace } from "@/lib/workspace";
import styles from "@/components/security-settings.module.css";

export const dynamic = "force-dynamic";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  const params = await searchParams;
  const locale = normalizeLocale(workspace.profile?.locale);
  return <main className={styles.challengeShell}><Link className={styles.challengeBrand} href="/"><Image src="/zuelen-icon.png" alt="" width={30} height={30}/><strong>Zuelen</strong></Link><MfaChallenge locale={locale} nextPath={safeInternalDestination(params.next)}/></main>;
}
