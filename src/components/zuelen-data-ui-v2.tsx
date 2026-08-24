import type { ComponentType, ReactNode } from "react";
import styles from "./zuelen-data-ui-v2.module.css";

type IconType = ComponentType<{ size?: number; className?: string }>;

type SummaryItem = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: IconType;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

export function DataSummary({ items, label = "Data summary" }: { items: SummaryItem[]; label?: string }) {
  return <section className={styles.summaryGrid} aria-label={label}>
    {items.map((item) => {
      const Icon = item.icon;
      return <article key={item.label} className={`${styles.summaryCard} ${styles[item.tone ?? "neutral"]}`}>
        <div className={styles.summaryTop}><span>{item.label}</span>{Icon ? <i><Icon size={16}/></i> : null}</div>
        <strong>{item.value}</strong>
        {item.description ? <small>{item.description}</small> : null}
      </article>;
    })}
  </section>;
}

export function DataPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${styles.dataPanel} ${className}`}>{children}</section>;
}

export function DataPanelHeader({ eyebrow, title, meta }: { eyebrow?: ReactNode; title: ReactNode; meta?: ReactNode }) {
  return <div className={styles.dataPanelHeader}><div>{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2></div>{meta ? <small>{meta}</small> : null}</div>;
}

export function DataToolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}

export function DataTableFrame({ children }: { children: ReactNode }) {
  return <div className={styles.tableFrame}>{children}</div>;
}

export function BulkActionBar({ count, selectedLabel = "selected", children }: { count: number; selectedLabel?: string; children: ReactNode }) {
  return <div className={styles.bulkActionBar} role="region" aria-label={`${count} ${selectedLabel}`}>
    <div className={styles.bulkCount}><strong>{count}</strong><span>{selectedLabel}</span></div>
    <div className={styles.bulkActions}>{children}</div>
  </div>;
}

export function DataEmptyState({ icon: Icon, title, description, action }: { icon: IconType; title: ReactNode; description: ReactNode; action?: ReactNode }) {
  return <div className={styles.emptyState}><span><Icon size={27}/></span><h3>{title}</h3><p>{description}</p>{action ? <div>{action}</div> : null}</div>;
}
