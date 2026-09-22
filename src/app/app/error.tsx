"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import styles from "./error.module.css";

export default function AppError({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <main className={styles.shell}>
    <section className={styles.card}>
      <span className={styles.icon}><AlertTriangle size={20}/></span>
      <div>
        <p>Zuelen</p>
        <h1>Something went wrong</h1>
        <span>Zuelen could not complete this page safely. Your data has not been changed by this error. Please try again.</span>
      </div>
      <button type="button" onClick={reset}><RotateCcw size={14}/>Try again</button>
    </section>
  </main>;
}
