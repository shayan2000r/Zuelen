"use client";

import Link from "next/link";
import { ArrowRight, Settings2 } from "lucide-react";
import { useI18n } from "@/components/locale-context";
import styles from "./taxes.module.css";

export function VatProfileCard({ frequency }: { frequency: string | null; year: number }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const frequencyLabel = frequency === "monthly"
    ? (fr ? "Mensuelle + annuelle" : "Monthly + annual")
    : frequency === "quarterly"
      ? (fr ? "Trimestrielle + annuelle" : "Quarterly + annual")
      : frequency === "annual"
        ? (fr ? "Annuelle" : "Annual")
        : (fr ? "À confirmer" : "To confirm");

  return <article className={styles.profileCard}>
    <div className={styles.profileHead}><div><p>{fr ? "Profil de déclaration" : "Filing profile"}</p><h2>{fr ? "Cadence AED" : "AED cadence"}</h2></div><Settings2 size={18}/></div>
    <p className={styles.profileLead}>{fr ? "La cadence enregistrée est utilisée pour organiser le calendrier TVA. Les seuils de chiffre d’affaires guident le régime standard, mais l’AED peut en décider autrement." : "The saved cadence organizes the VAT calendar. Revenue thresholds guide the standard regime, but the AED can decide otherwise."}</p>
    <div className={styles.thresholds}><div><strong>&lt; €112k</strong><span>{fr ? "normalement annuelle" : "normally annual"}</span></div><div><strong>€112k–€620k</strong><span>{fr ? "normalement trimestrielle" : "normally quarterly"}</span></div><div><strong>&gt; €620k</strong><span>{fr ? "normalement mensuelle" : "normally monthly"}</span></div></div>
    <div className={styles.profileLead}><strong>{fr ? "Cadence actuelle :" : "Current cadence:"} {frequencyLabel}</strong></div>
    <Link href="/app/settings">{fr ? "Modifier dans Paramètres" : "Change in Settings"} <ArrowRight size={14}/></Link>
  </article>;
}
