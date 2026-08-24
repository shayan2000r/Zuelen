import type { ComponentType, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "./zuelen-form-ui-v2.module.css";

type IconType = ComponentType<{ size?: number; className?: string }>;
type Tone = "default" | "success" | "error";

export function FormSection({ title, description, children, action }: { title: ReactNode; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className={styles.section}><div className={styles.sectionHead}><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{action}</div><div className={styles.sectionBody}>{children}</div></section>;
}

export function FieldGroup({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  return <div className={`${styles.group} ${styles[`columns${columns}`]}`}>{children}</div>;
}

export function Field({ label, description, error, success, icon: Icon, required, children }: { label: ReactNode; description?: ReactNode; error?: ReactNode; success?: boolean; icon?: IconType; required?: boolean; children: ReactNode }) {
  return <label className={`${styles.field} ${error ? styles.fieldError : success ? styles.fieldSuccess : ""}`}>
    <span className={styles.labelRow}><span>{Icon ? <Icon size={14}/> : null}<strong>{label}</strong>{required ? <em>*</em> : null}</span>{success && !error ? <Check size={14} className={styles.validIcon}/> : null}</span>
    <span className={styles.control}>{children}</span>
    {error ? <span className={styles.error}>{error}</span> : description ? <span className={styles.description}>{description}</span> : null}
  </label>;
}

export function TextField({ label, description, error, success, icon, required, className = "", ...props }: { label: ReactNode; description?: ReactNode; error?: ReactNode; success?: boolean; icon?: IconType; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} description={description} error={error} success={success} icon={icon} required={required}><input {...props} className={`${styles.input} ${className}`}/></Field>;
}

export function SelectField({ label, description, error, success, icon, required, children, className = "", ...props }: { label: ReactNode; description?: ReactNode; error?: ReactNode; success?: boolean; icon?: IconType; required?: boolean; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return <Field label={label} description={description} error={error} success={success} icon={icon} required={required}><span className={styles.selectWrap}><select {...props} className={`${styles.select} ${className}`}>{children}</select><ChevronDown size={14}/></span></Field>;
}

export function TextareaField({ label, description, error, success, icon, required, className = "", ...props }: { label: ReactNode; description?: ReactNode; error?: ReactNode; success?: boolean; icon?: IconType; required?: boolean } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label} description={description} error={error} success={success} icon={icon} required={required}><textarea {...props} className={`${styles.textarea} ${className}`}/></Field>;
}

export function ToggleField({ title, description, name, defaultChecked, disabled }: { title: ReactNode; description?: ReactNode; name?: string; defaultChecked?: boolean; disabled?: boolean }) {
  return <label className={`${styles.toggleRow} ${disabled ? styles.disabled : ""}`}><span><strong>{title}</strong>{description ? <small>{description}</small> : null}</span><span className={styles.toggle}><input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled}/><i/></span></label>;
}

export function ValidationHint({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.validation} ${styles[tone]}`}>{tone === "success" ? <Check size={13}/> : null}{children}</span>;
}
