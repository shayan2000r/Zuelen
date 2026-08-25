import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { resolveAuthenticatedDestination, safeInternalDestination } from "@/lib/auth-destination";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export default async function SignInPage({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const params=await searchParams,next=safeInternalDestination(params.next);
  const workspace = await getWorkspace();
  if (workspace.authenticated) redirect(await resolveAuthenticatedDestination(next));
  return <SignInForm nextPath={next}/>;
}
