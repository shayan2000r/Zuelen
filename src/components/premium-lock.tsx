import Link from "next/link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import styles from "./premium-lock.module.css";

export function PremiumLock({
  title,
  description,
  features,
  locale = "en",
}: {
  title: string;
  description: string;
  features: string[];
  locale?: "en" | "fr";
}) {
  const l = (en: string, fr: string) => locale === "fr" ? fr : en;
  return (
    <section className={styles.shell}>
      <div className={styles.preview} aria-hidden="true">
        <div className={styles.previewTop}>
          {[0, 1, 2].map(index => <div className={styles.mockCard} key={index}><div className={`${styles.line} ${styles.lineShort}`} /><div className={`${styles.line} ${styles.lineMedium}`} /><div className={styles.chart} /></div>)}
        </div>
        <div className={styles.mockWide}><div className={`${styles.line} ${styles.lineShort}`} /><div className={`${styles.line} ${styles.lineMedium}`} /><div className={styles.line} /><div className={styles.chart} /></div>
      </div>
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.icon}><LockKeyhole size={20} /></div>
          <span className={styles.eyebrow}>{l("Premium feature", "Fonctionnalité Premium")}</span>
          <h2>{title}</h2>
          <p>{description}</p>
          <div className={styles.features}>{features.slice(0, 4).map(feature => <span key={feature}><Check size={13} />{feature}</span>)}</div>
          <div className={styles.actions}><Link href="/app/settings/billing" className={styles.upgrade}>{l("Upgrade to Premium", "Passer à Premium")} <ArrowRight size={14}/></Link></div>
        </div>
      </div>
    </section>
  );
}
