"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole, X } from "lucide-react";
import styles from "./upgrade-wall.module.css";

export function UpgradeWall({ open, message, onClose, locale = "en" }: { open: boolean; message: string; onClose: () => void; locale?: "en" | "fr" }) {
  if (!open) return null;
  const l = (en: string, fr: string) => locale === "fr" ? fr : en;
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.card} role="dialog" aria-modal="true" aria-label={l("Upgrade to Premium", "Passer à Premium")}>
        <button className={styles.close} type="button" onClick={onClose} aria-label={l("Close", "Fermer")}><X size={17} /></button>
        <div className={styles.icon}><LockKeyhole size={20} /></div>
        <span className={styles.eyebrow}>{l("Basic limit reached", "Limite Basic atteinte")}</span>
        <h2>{l("Keep going with Premium", "Continuez avec Premium")}</h2>
        <p>{message}</p>
        <div className={styles.actions}><Link href="/app/settings/billing" className={styles.primary}>{l("Upgrade to Premium", "Passer à Premium")} <ArrowRight size={14}/></Link></div>
      </section>
    </div>
  );
}
