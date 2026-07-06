import { cookies } from "next/headers";

const TOKEN_COOKIE = "arena_token";

// Are.na access tokens do not expire, so a long-lived cookie is the whole session.
export async function getToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value ?? null;
}

export async function setToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
}
