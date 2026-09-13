import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import styles from "@/components/security-settings.module.css";

export const dynamic = "force-dynamic";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ lang?: string | string[] }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const locale = params.lang === "fr" ? "fr" : "en";

  return (
    <main className={styles.accountShell}>
      <Link className={styles.accountBrand} href="/sign-in">
        <Image src="/zuelen-icon.png" alt="" width={30} height={30} />
        <strong>Zuelen</strong>
      </Link>
      <ForgotPasswordForm locale={locale} />
    </main>
  );
}
