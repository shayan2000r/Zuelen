"use client";

import { ArrowRight, ArrowUp, BarChart3, FolderClock, Landmark, LoaderCircle, MessageSquarePlus, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { askCopilot, type CopilotState } from "@/app/app/copilot/actions";
import { useI18n } from "@/components/locale-context";
import { useRolePermissions } from "@/components/role-context";
import { UpgradeWall } from "@/components/upgrade-wall";
import styles from "./copilot.module.css";

const initial: CopilotState = { status: "idle", message: "" };
type Conversation = { id: string; title: string; created_at: string; updated_at: string };
type Message = { id: string; role: string; content: string; created_at: string };

export function CopilotPanel({ premium, initialQuestion = "", conversations, activeConversationId, messages }: { premium: boolean; initialQuestion?: string; conversations: Conversation[]; activeConversationId: string | null; messages: Message[] }) {
  const { canBookkeep } = useRolePermissions();
  const { locale, intlLocale } = useI18n();
  const fr = locale === "fr";
  const router = useRouter();
  const [state, action, pending] = useActionState(askCopilot, initial);
  const [question, setQuestion] = useState(initialQuestion);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedInitial = useRef(false);
  const prompts = fr
    ? ["Combien de TVA dois-je payer ?", "Quelle trésorerie puis-je utiliser sans risque ?", "Qu’est-ce qui bloque la clôture annuelle ?", "Expliquez-moi mon compte courant d’associé"]
    : ["How much VAT do I owe?", "How much cash can I safely use?", "What is blocking year-end?", "Explain my shareholder account"];
  const suggestions = fr
    ? [{ icon: Landmark, title: "Comprendre ma TVA", copy: "Expliquez la position issue des écritures et justificatifs." }, { icon: BarChart3, title: "Lire mes chiffres", copy: "Interrogez trésorerie, produits, charges et marges." }, { icon: ShieldCheck, title: "Préparer la clôture", copy: "Repérez les éléments réellement bloquants." }]
    : [{ icon: Landmark, title: "Understand my VAT", copy: "Explain the position grounded in entries and evidence." }, { icon: BarChart3, title: "Read my numbers", copy: "Ask about cash, revenue, expenses and margins." }, { icon: ShieldCheck, title: "Prepare year-end", copy: "Identify the items that are genuinely blocking." }];

  useEffect(() => {
    if (!submittedInitial.current && initialQuestion.trim().length >= 3 && canBookkeep) {
      submittedInitial.current = true;
      const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 80);
      return () => window.clearTimeout(timer);
    }
  }, [initialQuestion, canBookkeep]);
  useEffect(() => {
    if (state.status === "success" && state.conversationId) {
      const clearComposer = window.setTimeout(() => setQuestion(""), 0);
      const href = `/app/copilot?conversation=${state.conversationId}`;
      if (activeConversationId !== state.conversationId) router.replace(href); else router.refresh();
      return () => window.clearTimeout(clearComposer);
    }
  }, [state, activeConversationId, router]);

  return <div className={styles.shell}>
    <aside className={styles.history}>
      <div className={styles.historyHead}><div><FolderClock size={15}/><strong>{fr ? "Conversations" : "Conversations"}</strong></div>{canBookkeep ? <Link href="/app/copilot" aria-label={fr ? "Nouvelle conversation Copilot" : "New Copilot conversation"}><MessageSquarePlus size={15}/></Link> : null}</div>
      {canBookkeep ? <Link href="/app/copilot" className={styles.newChat}><Sparkles size={14}/>{fr ? "Nouvelle conversation" : "New conversation"}</Link> : null}
      <div className={styles.conversationList}>{conversations.length ? conversations.map(conversation => <Link href={`/app/copilot?conversation=${conversation.id}`} key={conversation.id} className={activeConversationId === conversation.id ? styles.conversationActive : ""}><strong>{conversation.title}</strong><small>{new Date(conversation.updated_at).toLocaleDateString(intlLocale, { day: "2-digit", month: "short", timeZone: "Europe/Luxembourg" })}</small></Link>) : <p>{fr ? "Vos conversations apparaîtront ici." : "Your conversations will appear here."}</p>}</div>
    </aside>

    <main className={styles.chat}>
      <header className={styles.chatHead}><div className={styles.chatIdentity}><span className={styles.logo}><Sparkles size={18}/></span><div><p>Zuelen Copilot</p><h1>{activeConversationId ? conversations.find(c => c.id === activeConversationId)?.title || (fr ? "Conversation" : "Conversation") : (fr ? "Votre copilote financier" : "Your financial copilot")}</h1></div></div>{premium ? <span className={styles.premiumBadge}><ShieldCheck size={13}/>Premium</span> : <Link href="/app/settings/billing" className={styles.upgradeCallout}><Sparkles size={14}/><span><strong>{fr ? "Débloquer Copilot" : "Unlock Copilot"}</strong><small>{fr ? "Passer à Premium" : "Upgrade plan"}</small></span><ArrowRight size={14}/></Link>}</header>

      <div className={styles.messages}>{messages.length ? messages.map(message => <article className={message.role === "user" ? styles.userMessage : styles.assistantMessage} key={message.id}><div className={styles.messageMeta}><span>{message.role === "user" ? (fr ? "Vous" : "You") : "Zuelen"}</span><small>{new Date(message.created_at).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Luxembourg" })}</small></div><div className={styles.messageBody}>{message.content}</div></article>) : <div className={styles.emptyState}>
        <div className={styles.orb} aria-hidden="true"><span/><Sparkles size={27}/></div>
        <span className={styles.eyebrow}>{fr ? "VOS CHIFFRES, EN LANGAGE CLAIR" : "YOUR NUMBERS, IN PLAIN LANGUAGE"}</span>
        <h2>{fr ? "Posez une question à votre comptabilité." : "Ask your books a business question."}</h2>
        <p>{canBookkeep ? (fr ? "Copilot explique les données déjà présentes dans votre espace et distingue les faits comptabilisés, les justificatifs et les estimations." : "Copilot explains the data already in your workspace and separates posted facts, evidence and estimates.") : (fr ? "Votre rôle Lecteur peut consulter les données, mais ne peut pas créer de conversation." : "Your Viewer role can inspect data, but cannot create a conversation.")}</p>
        {canBookkeep ? <div className={styles.suggestionGrid}>{suggestions.map((item,index) => <button type="button" key={item.title} onClick={() => setQuestion(prompts[index])}><span><item.icon size={17}/></span><strong>{item.title}</strong><small>{item.copy}</small></button>)}</div> : null}
      </div>}</div>

      {canBookkeep ? <div className={styles.composerWrap}><div className={styles.promptChips}>{prompts.map(prompt => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div><form ref={formRef} action={action} className={styles.ask} onSubmit={() => setUpgradeDismissed(false)}><input type="hidden" name="conversation_id" value={activeConversationId ?? ""}/><textarea name="question" value={question} onChange={event => setQuestion(event.target.value)} placeholder={fr ? "Demandez à Zuelen ce que racontent vos chiffres…" : "Ask Zuelen what your numbers are telling you…"} rows={3}/><div className={styles.askFoot}><span><ShieldCheck size={13}/>{fr ? "Lecture seule — aucune écriture n’est modifiée" : "Read-only — no entries are changed"}</span><button type="submit" disabled={pending || question.trim().length < 3} aria-label={fr ? "Interroger Zuelen" : "Ask Zuelen"}>{pending ? <LoaderCircle className={styles.spin}/> : <ArrowUp/>}</button></div></form>{state.status === "error" && !state.upgradeRequired ? <p className={styles.error}>{state.message}</p> : null}</div> : null}
    </main>
    <UpgradeWall open={Boolean(state.upgradeRequired) && !upgradeDismissed} message={state.message} locale={locale} onClose={() => setUpgradeDismissed(true)}/>
  </div>;
}
