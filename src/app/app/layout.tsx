import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import "./ui-polish.css";
import "./ui-2026.css";
import "./product-theme.css";
import "./dark-compat.css";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.organization || !workspace.company) redirect("/setup");

  const fiscalYear = new Date().getFullYear();
  const supabase = await createClient();
  const [{ count }, brandResult] = await Promise.all([
    supabase
      .from("source_transactions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", workspace.company.id)
      .in("classification_status", ["unclassified", "review"]),
    workspace.company.brand_image_path
      ? supabase.storage.from("company-documents").createSignedUrl(workspace.company.brand_image_path, 60 * 60)
      : Promise.resolve({ data: null, error: null }),
  ]);

  return (
    <AppFrame
      companyName={workspace.company.trading_name || workspace.company.legal_name}
      fiscalYear={fiscalYear}
      email={workspace.email}
      attentionCount={count ?? 0}
      brandImageUrl={brandResult.data?.signedUrl ?? null}
    >
      {children}
    </AppFrame>
  );
}
