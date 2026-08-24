"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeLocale } from "@/lib/i18n";
import { ACTIVE_ACCOUNTANT_SUBSCRIPTION_STATUSES, getProfessionalWorkspace } from "@/lib/professional-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveProfessionalSettingsAction(formData: FormData) {
  const { workspace, supabase } = await getProfessionalWorkspace(true);
  if (!workspace.userId) redirect("/sign-in?type=accountant");

  const locale = normalizeLocale(text(formData, "locale"));
  const professionalEmailUpdates = formData.get("professional_email_updates") === "on";
  const { error } = await supabase.from("user_profiles").upsert({
    user_id: workspace.userId,
    locale,
    professional_email_updates: professionalEmailUpdates,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);

  revalidatePath("/professional", "layout");
  revalidatePath("/accountants/directory");
  redirect("/professional/settings?saved=1");
}

export async function deleteProfessionalProfileAction(formData: FormData) {
  const { workspace, profile, subscription } = await getProfessionalWorkspace(true);
  if (!workspace.userId || !profile) redirect("/professional");

  if (text(formData, "confirmation") !== "DELETE") {
    redirect("/professional/settings?error=confirmation");
  }

  if (subscription && ACTIVE_ACCOUNTANT_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    redirect("/professional/settings?error=subscription");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("accountant_profiles").delete().eq("id", profile.id).eq("user_id", workspace.userId);
  if (error) throw new Error(error.message);

  revalidatePath("/professional", "layout");
  revalidatePath("/accountants/directory");
  revalidatePath("/app/accountants");
  redirect(workspace.company ? "/app" : "/accountants/directory?professional=deleted");
}
