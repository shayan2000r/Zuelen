"use server";

import { revalidatePath } from "next/cache";
import { normalizeLocale, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export async function setLocalePreference(locale: Locale) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) throw new Error("Your session expired. Please sign in again.");
  const nextLocale = normalizeLocale(locale);
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: workspace.userId,
        locale: nextLocale,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
  revalidatePath("/app/settings/profile");
  return nextLocale;
}
