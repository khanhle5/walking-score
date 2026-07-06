import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ARENA_AUTHORIZE_URL } from "@/lib/arena";

export async function GET(request: Request) {
  const clientId = process.env.ARENA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "ARENA_CLIENT_ID is not set — see .env.example" },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authorizeUrl = new URL(ARENA_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "write");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl);
}
