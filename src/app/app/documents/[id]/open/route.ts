import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getWorkspace();
  if (!workspace.authenticated) return NextResponse.redirect(new URL("/sign-in",request.url));
  if (!workspace.company) return NextResponse.redirect(new URL("/setup",request.url));
  const supabase = await createClient();
  const { data: document, error } = await supabase.from("documents").select("storage_path").eq("id",id).eq("company_id",workspace.company.id).maybeSingle();
  if (error || !document) return NextResponse.redirect(new URL("/app/documents?error=not_found",request.url));
  const { data, error: signedError } = await supabase.storage.from("company-documents").createSignedUrl(document.storage_path,60);
  if (signedError || !data?.signedUrl) return NextResponse.redirect(new URL("/app/documents?error=open_failed",request.url));
  return NextResponse.redirect(data.signedUrl);
}
