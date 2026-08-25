import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedDestination } from "@/lib/auth-destination";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const destination = await resolveAuthenticatedDestination(next);
  return NextResponse.redirect(new URL(destination, request.url));
}
