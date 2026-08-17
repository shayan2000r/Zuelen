import { redirect } from "next/navigation";
import { CopilotPanel } from "@/components/copilot-panel";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic="force-dynamic";
export default async function CopilotPage({searchParams}:{searchParams:Promise<{prompt?:string;conversation?:string}>}){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company||!workspace.userId)redirect("/setup");const params=await searchParams,supabase=await createClient();
 const{data:conversations,error}=await supabase.from("copilot_conversations").select("id,title,created_at,updated_at").eq("company_id",workspace.company.id).eq("created_by",workspace.userId).order("updated_at",{ascending:false}).limit(50);if(error)throw new Error(`Could not load Copilot history: ${error.message}`);
 const requested=params.conversation&&conversations?.some(c=>c.id===params.conversation)?params.conversation:null;let messages:Array<{id:string;role:string;content:string;created_at:string}>=[];if(requested){const{data,error:messageError}=await supabase.from("copilot_messages").select("id,role,content,created_at").eq("conversation_id",requested).order("created_at",{ascending:true});if(messageError)throw new Error(`Could not load conversation: ${messageError.message}`);messages=(data??[]) as typeof messages}
 return <CopilotPanel initialQuestion={params.prompt??""} conversations={conversations??[]} activeConversationId={requested} messages={messages}/>;
}
