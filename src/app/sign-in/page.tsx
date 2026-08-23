import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
function safeNext(value:string|undefined){return value&&value.startsWith("/")&&!value.startsWith("//")?value:null}

export default async function SignInPage({searchParams}:{searchParams:Promise<{next?:string;type?:string}>}) {
  const params=await searchParams,next=safeNext(params.next);
  const accountant=params.type==="accountant" || Boolean(next?.startsWith("/professional") || next?.startsWith("/accountants/"));
  const workspace = await getWorkspace();
  if (workspace.authenticated) redirect(accountant?"/professional":next??(workspace.company ? "/app" : "/setup"));
  return <SignInForm nextPath={next} initialAudience={accountant?"accountant":"business"}/>;
}
