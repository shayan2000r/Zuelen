"use server";

import { revalidatePath } from "next/cache";
import { requireZuelenAdmin } from "@/lib/admin";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewAccountantProfileAction(formData: FormData) {
  const profileId = text(formData, "profile_id");
  const decision = text(formData, "decision");
  const rejectionReason = text(formData, "rejection_reason");

  if (!profileId) throw new Error("Missing accountant profile.");
  if (decision !== "approved" && decision !== "rejected") throw new Error("Invalid review decision.");
  if (decision === "rejected" && rejectionReason.length < 5) {
    throw new Error("Add a short reason so the professional knows what to change.");
  }

  const { admin } = await requireZuelenAdmin("/admin/accountants");
  const { data: profile, error: profileError } = await admin
    .from("accountant_profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("Accountant profile not found.");

  const { error } = await admin
    .from("accountant_profiles")
    .update({
      approval_status: decision,
      approved_at: decision === "approved" ? new Date().toISOString() : null,
      rejection_reason: decision === "rejected" ? rejectionReason : null,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/accountants");
  revalidatePath("/accountants/manage");
  revalidatePath("/accountants/directory");
  revalidatePath("/app/accountants");
  redirect(`/admin/accountants?reviewed=${decision}`);
}
