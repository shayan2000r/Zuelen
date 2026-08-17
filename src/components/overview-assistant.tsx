"use client";

import { ArrowUp, Maximize2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "@/app/app/overview.module.css";

export function OverviewAssistant() {
  const [question, setQuestion] = useState("");

  return (
    <article className={styles.assistantCard}>
      <div className={styles.assistantHead}>
        <div>
          <span className={styles.cardLabel}>AI Assistant</span>
          <h2>Ask Compta</h2>
        </div>
        <Link href="/app/copilot" aria-label="Open Copilot"><Maximize2 size={15} /></Link>
      </div>

      <div className={styles.assistantVisual} aria-hidden="true">
        <span className={styles.orbHalo} />
        <span className={styles.aiOrb}><Sparkles size={17} /></span>
      </div>

      <div className={styles.assistantPromptHint}>Try “How much cash can I safely use?”</div>

      <form className={styles.assistantAsk} action="/app/copilot" method="get">
        <input
          name="prompt"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask me anything…"
          autoComplete="off"
        />
        <button type="submit" disabled={question.trim().length < 3} aria-label="Ask Compta"><ArrowUp size={15} /></button>
      </form>
    </article>
  );
}
