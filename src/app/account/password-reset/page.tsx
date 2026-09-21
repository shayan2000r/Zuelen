import Image from "next/image";
import Link from "next/link";
import { PasswordResetForm } from "@/components/password-reset-form";
import styles from "@/components/security-settings.module.css";

export const dynamic = "force-dynamic";

type PasswordResetPageProps = {
  searchParams: Promise<{ lang?: string | string[]; source?: string | string[] }>;
};

export default async function PasswordResetPage({ searchParams }: PasswordResetPageProps) {
  const params = await searchParams;
  const locale = params.lang === "fr" ? "fr" : "en";
  const onboardingAfterReset = params.source === "tester";

  return (
    <main className={styles.accountShell}>
      <Link className={styles.accountBrand} href="/sign-in">
        <Image src="/zuelen-icon.png" alt="" width={30} height={30} />
        <strong>Zuelen</strong>
      </Link>
      <PasswordResetForm locale={locale} onboardingAfterReset={onboardingAfterReset} />
    </main>
  );
}
