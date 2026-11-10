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

  const clientId = process.env.ARENA_CLIENT_ID;
  const clientSecret = process.env.ARENA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Are.na OAuth credentials are not configured");
    return NextResponse.redirect(new URL("/?error=auth", url.origin));
  }

  try {
    const res = await fetch(ARENA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${url.origin}/api/auth/callback`,
      }),
    });

    if (!res.ok) {
      // Do not log the response body: it could contain sensitive data.
      console.error("Are.na token exchange failed:", res.status);
      return NextResponse.redirect(new URL("/?error=auth", url.origin));
    }

    const data: unknown = await res.json();
    if (
      !data || typeof data !== "object" || !("access_token" in data) ||
      typeof data.access_token !== "string" || !data.access_token
    ) {
      console.error("Are.na token exchange returned no access token");
      return NextResponse.redirect(new URL("/?error=auth", url.origin));
    }
    await setToken(data.access_token);
  } catch {
    console.error("Are.na token exchange could not be completed");
    return NextResponse.redirect(new URL("/?error=auth", url.origin));
  }

  return NextResponse.redirect(new URL("/walk", url.origin));
}
