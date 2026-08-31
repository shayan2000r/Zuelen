"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { setLocalePreference } from "@/app/app/locale-actions";
import type { Locale } from "@/lib/i18n";
import styles from "./setup-toolbar.module.css";

export function SetupToolbar({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition();
  const fr = locale === "fr";
  function changeLocale(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => { await setLocalePreference(next); window.location.reload(); });
  }
  return <div className={styles.toolbar}>
    <div className={styles.languages} aria-label={fr ? "Langue" : "Language"}>
      <button type="button" aria-pressed={locale === "en"} onClick={() => changeLocale("en")} disabled={pending}>EN</button>
      <button type="button" aria-pressed={locale === "fr"} onClick={() => changeLocale("fr")} disabled={pending}>FR</button>
    </div>
    <form action="/auth/signout" method="post"><button type="submit" className={styles.exit}><LogOut size={14}/>{fr ? "Enregistrer et quitter" : "Save & exit"}</button></form>
  </div>;
}
