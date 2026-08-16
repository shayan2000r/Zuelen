"use client";

import { Printer } from "lucide-react";
import styles from "./invoice.module.css";

export function InvoicePrintButton() {
  return <button type="button" className={styles.printButton} onClick={() => window.print()}><Printer size={14} />Print / save PDF</button>;
}
