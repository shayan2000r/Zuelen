"use client";

import { ArrowUp, BookOpen, LoaderCircle, Sparkles } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { askCopilot, type CopilotState } from "@/app/app/copilot/actions";
import styles from "./copilot.module.css";

const initial: CopilotState = { status: "idle", message: "" };
const prompts = ["Explain my shareholder account", "How much VAT do I owe?", "What is blocking year-end?", "How much cash can I safely use?"];

export function CopilotPanel({ initialQuestion = "" }: { initialQuestion?: string }) {
  const [state, action, pending] = useActionState(askCopilot, initial);
  const [question, setQuestion] = useState(initialQuestion);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedInitial = useRef(false);

  useEffect(() => {
    if (!submittedInitial.current && initialQuestion.trim().length >= 3) {
      submittedInitial.current = true;
      const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 80);
      return () => window.clearTimeout(timer);
    }
  }, [initialQuestion]);

  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <span className={styles.spark}><Sparkles /></span>
        <div><p>Compta Copilot</p><h1>Answers without the accounting jargon.</h1><span>Compta starts with the simple answer, then separates the numbers and next step.</span></div>
      </div>
      <div className={styles.prompts}>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div>
      {state.answer ? (
        <article className={styles.answer}>
          <div className={styles.answerHead}><span><Sparkles /><strong>Simple answer</strong></span><span className={styles.grounded}>Grounded in your books</span></div>
          <div className={styles.answerText}>{state.answer}</div>
          <div className={styles.detailHint}><BookOpen size={14} /><span>Need debit, credit or PCN detail? Ask “show the accounting detail”.</span></div>
        </article>
      ) : (
        <article className={styles.empty}><strong>Your financial context is connected.</strong><p>Ask in everyday language. Compta will keep the first answer short and practical.</p></article>
      )}
      <form ref={formRef} action={action} className={styles.ask}>
        <textarea name="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask Compta about your company…" rows={3} />
        <button type="submit" disabled={pending || question.trim().length < 3} aria-label="Ask Compta">{pending ? <LoaderCircle className={styles.spin} /> : <ArrowUp />}</button>
      </form>
      {state.status === "error" ? <p className={styles.error}>{state.message}</p> : null}
      <footer>Read-only · Copilot cannot post entries or submit filings.</footer>
    </div>
  );
}
