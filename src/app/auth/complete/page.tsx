import { AuthComplete } from "@/components/auth-complete";

export const dynamic="force-dynamic";
function safeNext(value:string|undefined){return value&&value.startsWith("/")&&!value.startsWith("//")?value:"/app"}

export default async function AuthCompletePage({searchParams}:{searchParams:Promise<{next?:string}>}){
 const params=await searchParams;
 return <AuthComplete nextPath={safeNext(params.next)}/>;
}
