import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import styles from "./zuelen-ui-v2.module.css";

type IconType = ComponentType<{ size?: number; className?: string }>;

type ActionLike = {
  label: string;
  href?: string;
  icon?: IconType;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function V2Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.page} ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, meta, actions = [] }: { eyebrow?: string; title: ReactNode; description?: ReactNode; meta?: ReactNode; actions?: ActionLike[] }) {
  return <header className={styles.pageHeader}>
    <div className={styles.pageHeaderCopy}>
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {meta || actions.length ? <div className={styles.headerActions}>{meta}{actions.map(action => <V2Button key={`${action.label}-${action.href ?? "button"}`} {...action}/>)}</div> : null}
  </header>;
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <section className={styles.metricGrid}>{children}</section>;
}

export function MetricCard({ label, value, description, icon: Icon, trend, href }: { label: string; value: ReactNode; description?: ReactNode; icon?: IconType; trend?: { value: string; direction?: "up" | "down" | "neutral" }; href?: string }) {
  const content = <>
    <div className={styles.metricLabelRow}><span className={styles.metricLabel}>{label}</span>{Icon ? <span className={styles.metricIcon}><Icon size={16}/></span> : null}</div>
    <div className={styles.metricValueRow}><strong className={styles.metricValue}>{value}</strong>{trend ? <TrendChip {...trend}/> : null}</div>
    {description ? <p className={styles.metricDescription}>{description}</p> : null}
  </>;
  return href ? <Link href={href} className={styles.metricCard}>{content}</Link> : <article className={styles.metricCard}>{content}</article>;
}

export function TrendChip({ value, direction = "neutral" }: { value: string; direction?: "up" | "down" | "neutral" }) {
  const className = direction === "up" ? styles.trendPositive : direction === "down" ? styles.trendNegative : styles.trendNeutral;
  return <span className={`${styles.trend} ${className}`}>{direction === "up" ? <ArrowUpRight size={12}/> : direction === "down" ? <ArrowDownRight size={12}/> : null}{value}</span>;
}

export function Panel({ children, padded = true, premium = false, className = "" }: { children: ReactNode; padded?: boolean; premium?: boolean; className?: string }) {
  return <article className={`${styles.panel} ${padded ? styles.panelPadded : ""} ${premium ? styles.panelPremium : ""} ${className}`}>{children}</article>;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <div className={styles.sectionHeader}><div className={styles.sectionHeaderCopy}>{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{action}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  const toneClass = tone === "success" ? styles.badgeSuccess : tone === "warning" ? styles.badgeWarning : tone === "danger" ? styles.badgeDanger : tone === "info" ? styles.badgeInfo : styles.badgeNeutral;
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}

export function V2Button({ label, href, icon: Icon, variant = "secondary" }: ActionLike) {
  const variantClass = variant === "primary" ? styles.buttonPrimary : variant === "ghost" ? styles.buttonGhost : variant === "danger" ? styles.buttonDanger : styles.buttonSecondary;
  const content = <>{Icon ? <Icon size={15}/> : null}<span>{label}</span></>;
  return href ? <Link href={href} className={`${styles.button} ${variantClass}`}>{content}</Link> : <button type="button" className={`${styles.button} ${variantClass}`}>{content}</button>;
}

export function EmptyState({ icon: Icon, title, description, primaryAction, secondaryAction }: { icon: IconType; title: ReactNode; description: ReactNode; primaryAction?: ActionLike; secondaryAction?: ActionLike }) {
  return <div className={styles.emptyState}><div className={styles.emptyStateInner}><span className={styles.emptyVisual}><Icon size={28}/></span><h3>{title}</h3><p>{description}</p>{primaryAction || secondaryAction ? <div className={styles.emptyActions}>{primaryAction ? <V2Button {...primaryAction} variant={primaryAction.variant ?? "primary"}/> : null}{secondaryAction ? <V2Button {...secondaryAction}/> : null}</div> : null}</div></div>;
}

export function V2Stack({ children }: { children: ReactNode }) { return <div className={styles.stack}>{children}</div>; }
export function V2TwoColumn({ children }: { children: ReactNode }) { return <div className={styles.twoColumn}>{children}</div>; }
