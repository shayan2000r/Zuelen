import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountantManagePage({ searchParams }: { searchParams: Promise<{ saved?: string; checkout?: string; plan?: string }> }) {
  const params = await searchParams;
  if (params.checkout === "success") redirect("/professional?checkout=success");
  if (params.plan === "basic" || params.plan === "premium") redirect(`/professional/billing?plan=${params.plan}`);
  if (params.saved) redirect("/professional/profile?saved=1");
  redirect("/professional/profile");
}
