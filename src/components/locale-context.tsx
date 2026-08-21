"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import {
  buildAccountTextMap,
  financialDocumentName,
  financialDocumentNames,
  intlLocale,
  localizedAccountLabel,
  t as translate,
  translateLegacyText,
  type AccountTranslation,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  intlLocale: string;
  t: (key: MessageKey) => string;
  accountLabel: (account: Pick<AccountTranslation, "label" | "label_en" | "label_fr">) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);
const ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

function bridgeTranslate(locale: Locale, value: string, accountMap: Record<string, string>) {
  if (locale !== "fr") return value;
  const leading=value.match(/^\s*/)?.[0]??"",trailing=value.match(/\s*$/)?.[0]??"",core=value.trim();
  for(const [type,names] of Object.entries(financialDocumentNames)){
    if(core===names.en)return `${leading}${financialDocumentName(type,locale)}${trailing}`;
    const match=core.match(new RegExp(`^${names.en.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*[·|-]\\s*(\\d{4})$`));
    if(match)return `${leading}${financialDocumentName(type,locale)} · ${match[1]}${trailing}`;
  }
  const fy=core.match(/^FY\s+(\d{4})(.*)$/i);if(fy)return `${leading}${fy[1]}${fy[2]}${trailing}`;
  return translateLegacyText(locale,value,accountMap);
}

function translateTextNode(node: Text, locale: Locale, accountMap: Record<string, string>) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("[data-no-i18n='true']")) return;
  const current = node.nodeValue ?? "";
  const next = bridgeTranslate(locale, current, accountMap);
  if (next !== current) node.nodeValue = next;
}

function translateElementAttributes(element: Element, locale: Locale, accountMap: Record<string, string>) {
  if (element.closest("[data-no-i18n='true']")) return;
  for (const attr of ATTRIBUTES) {
    const current = element.getAttribute(attr);
    if (!current) continue;
    const next = bridgeTranslate(locale, current, accountMap);
    if (next !== current) element.setAttribute(attr, next);
  }
}

function translateTree(root: Node, locale: Locale, accountMap: Record<string, string>) {
  if (locale !== "fr") return;
  if (root.nodeType === Node.TEXT_NODE) {translateTextNode(root as Text, locale, accountMap);return;}
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root as Element, locale, accountMap);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, locale, accountMap);else translateElementAttributes(node as Element, locale, accountMap);node = walker.nextNode();}
}

export function LocaleProvider({children,locale,accountTranslations}:{children:ReactNode;locale:Locale;accountTranslations:AccountTranslation[]}) {
  const accountMap = useMemo(() => buildAccountTextMap(locale, accountTranslations), [locale, accountTranslations]);
  const value = useMemo<LocaleContextValue>(() => ({locale,intlLocale:intlLocale(locale),t:(key)=>translate(locale,key),accountLabel:(account)=>localizedAccountLabel(locale,account)}),[locale]);
  useEffect(() => {
    document.documentElement.lang = locale;document.documentElement.dataset.zuelenLocale = locale;
    if (locale !== "fr") return;
    const shell = document.querySelector(".app-shell");if (!shell) return;
    translateTree(shell, locale, accountMap);
    const observer = new MutationObserver((mutations) => {for (const mutation of mutations) {if (mutation.type === "characterData") translateTree(mutation.target, locale, accountMap);for (const added of mutation.addedNodes) translateTree(added, locale, accountMap);if (mutation.type === "attributes" && mutation.target instanceof Element) translateElementAttributes(mutation.target, locale, accountMap);}});
    observer.observe(shell,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...ATTRIBUTES]});
    return () => observer.disconnect();
  }, [locale, accountMap]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(){const context=useContext(LocaleContext);if(!context)throw new Error("useI18n must be used within LocaleProvider");return context;}
