import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { availableFiscalYears, fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { normalizeLocale, type AccountTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import "./ui-polish.css";
import "./ui-2026.css";
import "./product-theme.css";
import "./dark-compat.css";
import "./workflow-upgrades.css";
import "./zuelen-gradient-theme.css";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.organization || !workspace.company) redirect("/setup");

  const fiscalYear = await getActiveFiscalYear(workspace.company.fiscal_year_start_month);
  const bounds = fiscalYearBounds(fiscalYear, workspace.company.fiscal_year_start_month);
  const fiscalYears = availableFiscalYears(fiscalYear, workspace.company.fiscal_year_start_month);
  const supabase = await createClient();
  const [{ count }, brandResult, avatarResult, accountsResult] = await Promise.all([
    supabase
      .from("source_transactions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", workspace.company.id)
      .in("classification_status", ["unclassified", "review"])
      .gte("occurred_on", bounds.start)
      .lte("occurred_on", bounds.end),
    workspace.company.brand_image_path
      ? supabase.storage.from("company-documents").createSignedUrl(workspace.company.brand_image_path, 60 * 60)
      : Promise.resolve({ data: null, error: null }),
    workspace.profile?.avatar_path
      ? supabase.storage.from("user-avatars").createSignedUrl(workspace.profile.avatar_path, 60 * 60)
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("company_accounts")
      .select("code,label,label_en,label_fr")
      .eq("company_id", workspace.company.id)
      .order("code", { ascending: true }),
  ]);
  if (accountsResult.error) throw new Error(accountsResult.error.message);

  return (
    <AppFrame
      companyName={workspace.company.trading_name || workspace.company.legal_name}
      fiscalYear={fiscalYear}
      fiscalYears={fiscalYears}
      email={workspace.email}
      userName={workspace.profile?.full_name ?? null}
      userRole={workspace.role}
      userAvatarUrl={avatarResult.data?.signedUrl ?? null}
      attentionCount={count ?? 0}
      brandImageUrl={brandResult.data?.signedUrl ?? null}
      locale={normalizeLocale(workspace.profile?.locale)}
      accountTranslations={(accountsResult.data ?? []) as AccountTranslation[]}
    >
      {children}
    </AppFrame>
  );
}
