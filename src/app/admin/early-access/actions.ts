"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { allowEarlyAccessEmail, normalizeEarlyAccessEmail } from "@/lib/early-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspace } from "@/lib/workspace";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function reviewerAdminClient() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) redirect("/sign-in?next=/admin/early-access");

  const admin = createAdminClient();
  const { data: reviewer, error } = await admin
    .from("early_access_reviewers")
    .select("user_id")
    .eq("user_id", workspace.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!reviewer) throw new Error("You are not authorized to review early-access requests.");
  return admin;
}

function invitationMessage(locale: "fr" | "en", actionLink: string) {
  const fr = locale === "fr";
  const subject = fr ? "Votre accès Zuelen est prêt" : "Your Zuelen access is ready";
  const eyebrow = fr ? "Invitation personnelle" : "Personal invitation";
  const title = fr ? "Bienvenue dans Zuelen Early Access." : "Welcome to Zuelen Early Access.";
  const intro = fr
    ? "Votre demande a été approuvée. Votre place est maintenant disponible et vous pouvez activer votre compte Zuelen."
    : "Your request has been approved. Your place is now available and you can activate your Zuelen account.";
  const action = fr ? "Activer mon accès" : "Activate my access";
  const note = fr
    ? "Ce lien est personnel et sécurisé. Après activation, vous pourrez définir votre mot de passe et poursuivre avec l’onboarding Zuelen existant."
    : "This is a personal, secure link. After activation, you can set your password and continue with the existing Zuelen onboarding.";
  const footer = fr ? "Zuelen · Gestion financière pensée pour le Luxembourg" : "Zuelen · Financial management built for Luxembourg";
  const html = '<!doctype html><html><body style="margin:0;background:#f5f7f4;font-family:Inter,Arial,sans-serif;color:#142018"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f5f7f4"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e1e7e1;border-radius:20px;overflow:hidden"><tr><td style="padding:28px 32px;background:#111b14"><div style="font-size:24px;font-weight:800;color:#ffffff">Zuelen</div><div style="margin-top:5px;font-size:12px;color:#a9b8ad">Early Access · Luxembourg</div></td></tr><tr><td style="padding:36px 32px"><div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#287a40">' + eyebrow + '</div><h1 style="margin:10px 0 14px;font-size:30px;line-height:1.15;letter-spacing:-1px;color:#142018">' + title + '</h1><p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#5e6b62">' + intro + '</p><a href="' + actionLink + '" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#287a40;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800">' + action + ' →</a><p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#718078">' + note + '</p></td></tr><tr><td style="padding:20px 32px;background:#f8faf8;border-top:1px solid #e8ece8;font-size:11px;line-height:1.6;color:#7d8980">' + footer + '</td></tr></table></td></tr></table></body></html>';
  const plain = title + "\n\n" + intro + "\n\n" + actionLink + "\n\n" + note + "\n\n" + footer;
  return { subject, html, plain };
}

export async function inviteEarlyAccessAction(formData: FormData) {
  const id = text(formData, "id");
  if (!id) throw new Error("Missing early-access request.");

  const admin = await reviewerAdminClient();
  const { data: request, error: requestError } = await admin
    .from("early_access_waitlist")
    .select("id,email,audience,locale,status,approved_at")
    .eq("id", id)
    .maybeSingle();

  if (requestError) throw new Error(requestError.message);
  if (!request) throw new Error("Early-access request not found.");
  if (request.status === "activated") redirect("/admin/early-access?result=already-active");

  const email = normalizeEarlyAccessEmail(request.email);
  const locale: "fr" | "en" = request.locale === "fr" ? "fr" : "en";
  const now = new Date().toISOString();

  await allowEarlyAccessEmail(email, "waitlist_approval");
  const { error: approvalError } = await admin
    .from("early_access_waitlist")
    .update({
      status: request.status === "invited" ? "invited" : "approved",
      approved_at: request.approved_at || now,
      updated_at: now,
    })
    .eq("id", id);
  if (approvalError) throw new Error(approvalError.message);

  const redirectTo = APP_URL + "/auth/complete?next=" + encodeURIComponent("/account/password-reset");
  let linkData = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, data: { locale, early_access: true, audience: request.audience } },
  });

  if (linkData.error) {
    linkData = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo, data: { locale, early_access: true, audience: request.audience } },
    });
  }
  if (linkData.error) throw new Error(linkData.error.message);

  const actionLink = linkData.data.properties?.action_link;
  if (!actionLink) throw new Error("Supabase did not return an invitation link.");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const message = invitationMessage(locale, actionLink);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": "early-access-invite-" + id + "-" + Date.now(),
    },
    body: JSON.stringify({
      from: process.env.ZUELEN_EARLY_ACCESS_FROM || "Zuelen <access@zuelen.lu>",
      to: [email],
      subject: message.subject,
      text: message.plain,
      html: message.html,
    }),
  });
  if (!response.ok) throw new Error("Invitation email could not be delivered (" + response.status + ").");

  const { error: invitedError } = await admin
    .from("early_access_waitlist")
    .update({ status: "invited", invited_at: now, updated_at: now })
    .eq("id", id);
  if (invitedError) throw new Error(invitedError.message);

  revalidatePath("/admin/early-access");
  redirect("/admin/early-access?result=invited");
}

export async function rejectEarlyAccessAction(formData: FormData) {
  const id = text(formData, "id");
  if (!id) throw new Error("Missing early-access request.");
  const admin = await reviewerAdminClient();
  const { error } = await admin
    .from("early_access_waitlist")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "activated");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/early-access");
  redirect("/admin/early-access?result=rejected");
}
