"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireZuelenAdmin } from "@/lib/admin";
import { allowEarlyAccessEmail, normalizeEarlyAccessEmail } from "@/lib/early-access";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function findUserByEmail(
  admin: Awaited<ReturnType<typeof requireZuelenAdmin>>["admin"],
  email: string,
): Promise<any | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const match = data.users.find(user => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function inviteTesterAction(formData: FormData) {
  const email = normalizeEarlyAccessEmail(text(formData, "email"));
  if (!email || !email.includes("@")) {
    redirect("/admin/users?tester=invalid-email");
  }

  const { admin } = await requireZuelenAdmin("/admin/users");
  let existing = await findUserByEmail(admin, email);

  if (
    existing &&
    !existing.email_confirmed_at &&
    !existing.last_sign_in_at &&
    existing.user_metadata?.tester === true
  ) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) throw new Error(deleteError.message);
    existing = null;
  }

  if (existing) {
    redirect("/admin/users?tester=already-exists");
  }

  const redirectTo =
    APP_URL +
    "/auth/complete?next=" +
    encodeURIComponent("/account/password-reset?source=tester");

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      locale: "en",
      tester: true,
      source: "upwork_test",
    },
  });

  if (inviteError) {
    const created = await findUserByEmail(admin, email);
    if (
      created &&
      !created.email_confirmed_at &&
      !created.last_sign_in_at &&
      created.user_metadata?.tester === true
    ) {
      try {
        await admin.auth.admin.deleteUser(created.id);
      } catch {}
    }
    console.error("Tester invitation delivery failed", inviteError.message);
    redirect("/admin/users?tester=invite-error");
  }

  try {
    await allowEarlyAccessEmail(email, "manual");
  } catch (error) {
    if (inviteData.user?.id) {
      try {
        await admin.auth.admin.deleteUser(inviteData.user.id);
      } catch {}
    }
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect("/admin/users?tester=invited");
}
