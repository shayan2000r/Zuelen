import "server-only";

import type { AccountantTier } from "@/lib/accountants";
import { createAdminClient } from "@/lib/supabase/admin";

type TrialEmailInput = {
  subscriptionId: string;
  profileId: string;
  tier: AccountantTier;
  trialEnd: string;
  nextBillingDate: string;
  unitAmount: number;
  currency: string;
  quantity: number;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function formatDate(value: string, locale: "en" | "fr") {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-LU" : "en-LU", { dateStyle: "long", timeZone: "Europe/Luxembourg" }).format(new Date(value));
}

function formatAmount(cents: number, currency: string, locale: "en" | "fr") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-LU" : "en-LU", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

async function claimDelivery(deliveryKey: string) {
  const admin = createAdminClient();
  const startedAt = new Date().toISOString();
  const { error } = await admin.from("transactional_email_deliveries").insert({
    delivery_key: deliveryKey,
    kind: "accountant_trial_confirmation",
    status: "processing",
    processing_started_at: startedAt,
  });
  if (!error) return true;
  if (error.code !== "23505") throw new Error(error.message);

  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: reclaimed, error: reclaimError } = await admin.from("transactional_email_deliveries")
    .update({ status: "processing", processing_started_at: startedAt, last_error: null })
    .eq("delivery_key", deliveryKey)
    .or(`status.eq.failed,and(status.eq.processing,processing_started_at.lt.${staleBefore})`)
    .select("delivery_key")
    .maybeSingle();
  if (reclaimError) throw new Error(reclaimError.message);
  if (!reclaimed) return false;
  return true;
}

export async function sendAccountantTrialConfirmation(input: TrialEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Accountant trial email configuration is incomplete.");

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("accountant_profiles")
    .select("user_id,full_name")
    .eq("id", input.profileId)
    .single();
  if (profileError) throw new Error(profileError.message);
  const [{ data: userProfile, error: localeError }, { data: authUser, error: authError }] = await Promise.all([
    admin.from("user_profiles").select("locale").eq("user_id", profile.user_id).maybeSingle(),
    admin.auth.admin.getUserById(profile.user_id),
  ]);
  if (localeError) throw new Error(localeError.message);
  if (authError) throw new Error(authError.message);
  const recipient = authUser.user?.email;
  if (!recipient) throw new Error("Accountant trial email recipient is unavailable.");

  const deliveryKey = `accountant-trial-confirmation:${input.subscriptionId}`;
  if (!await claimDelivery(deliveryKey)) return;

  const locale: "en" | "fr" = userProfile?.locale === "fr" ? "fr" : "en";
  const amount = formatAmount(input.unitAmount * Math.max(1, input.quantity), input.currency, locale);
  const trialEnd = formatDate(input.trialEnd, locale);
  const nextBillingDate = formatDate(input.nextBillingDate, locale);
  const planName = input.tier === "premium" ? "Premium" : "Basic";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";
  const firstName = escapeHtml(String(profile.full_name || "").trim().split(/\s+/)[0] || (locale === "fr" ? "bonjour" : "there"));
  const subject = locale === "fr" ? `Bienvenue sur Zuelen — votre essai ${planName} a commencé` : `Welcome to Zuelen — your ${planName} trial has started`;
  const copy = locale === "fr" ? {
    hello: `Bonjour ${firstName},`,
    intro: "Bienvenue sur Zuelen. Votre espace professionnel est prêt et votre essai gratuit a commencé.",
    plan: "Formule sélectionnée",
    trial: "Fin de l’essai gratuit",
    amount: "Montant facturé après l’essai",
    billing: "Prochaine date de facturation",
    button: "Ouvrir Zuelen",
    note: "Vous pouvez gérer votre formule et vos moyens de paiement à tout moment depuis Abonnement & facturation.",
  } : {
    hello: `Hello ${firstName},`,
    intro: "Welcome to Zuelen. Your professional workspace is ready and your free trial has started.",
    plan: "Selected plan",
    trial: "Free-trial end date",
    amount: "Amount charged after the trial",
    billing: "Next billing date",
    button: "Open Zuelen",
    note: "You can manage your plan and payment details at any time from Subscription & billing.",
  };
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#142117"><div style="max-width:620px;margin:0 auto;padding:36px 20px"><div style="background:#fff;border:1px solid #dfe7e0;border-radius:22px;overflow:hidden"><div style="padding:28px 32px;background:#102017;color:#fff"><div style="font-size:22px;font-weight:800">Zuelen</div><div style="margin-top:8px;color:#b9cfbf;font-size:13px">Professional workspace</div></div><div style="padding:32px"><h1 style="font-size:24px;margin:0 0 14px">${copy.hello}</h1><p style="font-size:15px;line-height:1.65;color:#526157">${copy.intro}</p><div style="margin:24px 0;border:1px solid #dfe7e0;border-radius:16px;overflow:hidden">${[[copy.plan, planName],[copy.trial, trialEnd],[copy.amount, amount],[copy.billing, nextBillingDate]].map(([label, val]) => `<div style="display:flex;justify-content:space-between;gap:18px;padding:14px 16px;border-bottom:1px solid #edf1ed"><span style="color:#6b786f;font-size:13px">${label}</span><strong style="font-size:13px;text-align:right">${val}</strong></div>`).join("")}</div><a href="${escapeHtml(appUrl)}/professional" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#1f7a3d;color:#fff;text-decoration:none;font-weight:700">${copy.button}</a><p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#77827a">${copy.note}</p></div></div></div></body></html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": deliveryKey },
      body: JSON.stringify({ from, to: [recipient], subject, html }),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !payload.id) throw new Error(payload.message || `Resend returned ${response.status}`);
    const { error: completeError } = await admin.from("transactional_email_deliveries").update({ status: "sent", external_id: payload.id, sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("delivery_key", deliveryKey);
    if (completeError) throw new Error(completeError.message);
  } catch (error) {
    await admin.from("transactional_email_deliveries").update({ status: "failed", last_error: "Delivery failed; safe to retry.", updated_at: new Date().toISOString() }).eq("delivery_key", deliveryKey);
    throw error;
  }
}
