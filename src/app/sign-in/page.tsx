import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const workspace = await getWorkspace();
  if (workspace.authenticated) redirect(workspace.company ? "/app" : "/setup");
  return <SignInForm />;
}
