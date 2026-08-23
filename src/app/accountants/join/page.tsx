import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AccountantJoinPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in?next=/accountants/manage");
  redirect("/accountants/manage");
}
