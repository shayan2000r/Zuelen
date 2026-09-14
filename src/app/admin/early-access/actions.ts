"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { allowEarlyAccessEmail, normalizeEarlyAccessEmail } from "@/lib/early-access";
import { requireZuelenAdmin } from "@/lib/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function findUserByEmail(admin: Awaited<ReturnType<typeof requireZuelenAdmin>>["admin"], email: string): Promise<any | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const match = data.users.find(user => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function inviteEarlyAccessAction(formData: FormData) {
  const id = text(formData, "id");
  if (!id) throw new Error("Missing early-access request.");

  const { admin } = await requireZuelenAdmin("/admin/early-access");
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
  const redirectTo = APP_URL + "/auth/complete?next=" + encodeURIComponent("/account/password-reset");

  let existing = await findUserByEmail(admin, email);

  // A previous failed invitation may have created an unconfirmed auth record
  // before any email was delivered. Remove only that safe-to-recreate shell.
  if (
    existing &&
    !existing.email_confirmed_at &&
    !existing.last_sign_in_at &&
    existing.user_metadata?.early_access === true
  ) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) throw new Error(deleteError.message);
    existing = null;
  }

  if (existing?.email_confirmed_at || existing?.last_sign_in_at) {
    await allowEarlyAccessEmail(email, "waitlist_approval");
    const { error } = await admin
      .from("early_access_waitlist")
      .update({
        status: "activated",
        approved_at: request.approved_at || now,
        activated_at: now,
        updated_at: now,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/early-access");
    revalidatePath("/admin/users");
    redirect("/admin/early-access?result=already-active");
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { locale, early_access: true, audience: request.audience },
  });

  if (inviteError) {
    // Avoid phantom users after a delivery failure.
    const created = await findUserByEmail(admin, email);
    if (created && !created.email_confirmed_at && !created.last_sign_in_at && created.user_metadata?.early_access === true) {
      try { await admin.auth.admin.deleteUser(created.id); } catch {}
    }
    throw new Error("Invitation email could not be delivered: " + inviteError.message);
  }

  await allowEarlyAccessEmail(email, "waitlist_approval");
  const { error: invitedError } = await admin
    .from("early_access_waitlist")
    .update({
      status: "invited",
      approved_at: request.approved_at || now,
      invited_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (invitedError) throw new Error(invitedError.message);

  revalidatePath("/admin");
  revalidatePath("/admin/early-access");
  revalidatePath("/admin/users");
  redirect("/admin/early-access?result=invited");
}

export async function rejectEarlyAccessAction(formData: FormData) {
  const id = text(formData, "id");
  if (!id) throw new Error("Missing early-access request.");
  const { admin } = await requireZuelenAdmin("/admin/early-access");
  const { data: request, error: requestError } = await admin
    .from("early_access_waitlist")
    .select("email,status")
    .eq("id", id)
    .maybeSingle();
  if (requestError) throw new Error(requestError.message);
  if (!request || request.status === "activated") redirect("/admin/early-access?result=already-active");

  const email = normalizeEarlyAccessEmail(request.email);
  const { error } = await admin
    .from("early_access_waitlist")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: revokeError } = await admin
    .from("early_access_allowed_emails")
    .delete()
    .eq("email", email)
    .eq("source", "waitlist_approval");
  if (revokeError) throw new Error(revokeError.message);

  revalidatePath("/admin");
  revalidatePath("/admin/early-access");
  revalidatePath("/admin/users");
  redirect("/admin/early-access?result=rejected");
}
