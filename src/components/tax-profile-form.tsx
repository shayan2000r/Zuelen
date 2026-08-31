"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/locale-context";
import styles from "./tax-reserve.module.css";

export function TaxProfileForm({ municipality, multiplier, year, priorBalance }: { municipality: string | null; multiplier: number | null; year: number; priorBalance: number | null }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const money = new Intl.NumberFormat(fr ? "fr-LU" : "en-LU", { style: "currency", currency: "EUR" });
  return <div className={styles.profileForm}>
    <div><span>{fr ? "Commune" : "Municipality"}</span><strong>{municipality || (fr ? "Non renseignée" : "Not set")}</strong></div>
    <div><span>{fr ? "Multiplicateur ICC" : "ICC multiplier"}</span><strong>{multiplier !== null ? `${(multiplier * 100).toFixed(2)}%` : (fr ? "Non confirmé" : "Not confirmed")}</strong></div>
    <div><span>{fr ? "Année du taux" : "Rate year"}</span><strong>{year}</strong></div>
    <div><span>{fr ? "Total du bilan précédent" : "Prior closing balance"}</span><strong>{priorBalance == null ? (fr ? "Non renseigné" : "Not set") : money.format(priorBalance)}</strong></div>
    <Link href="/app/settings">{fr ? "Modifier dans Paramètres" : "Change in Settings"} <ArrowRight size={14}/></Link>
  </div>;
}
