import { NextResponse } from "next/server";
import { clearToken } from "@/lib/session";

export async function POST(request: Request) {
  await clearToken();
  return NextResponse.redirect(new URL("/", new URL(request.url).origin));
}
