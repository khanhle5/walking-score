import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ARENA_TOKEN_URL } from "@/lib/arena";
import { setToken } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?error=auth", url.origin));
  }

  const res = await fetch(ARENA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ARENA_CLIENT_ID ?? "",
      client_secret: process.env.ARENA_CLIENT_SECRET ?? "",
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });

  if (!res.ok) {
    console.error("Token exchange failed:", res.status, await res.text());
    return NextResponse.redirect(new URL("/?error=auth", url.origin));
  }

  const { access_token } = (await res.json()) as { access_token: string };
  await setToken(access_token);

  return NextResponse.redirect(new URL("/walk", url.origin));
}
