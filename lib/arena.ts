export const ARENA_API = "https://api.are.na/v3";
export const ARENA_AUTHORIZE_URL = "https://www.are.na/oauth/authorize";
export const ARENA_TOKEN_URL = "https://api.are.na/v3/oauth/token";

// Real /v3/me shape (verified): display name is `name`, URL handle is `slug`.
// There is no `username` field.
export interface ArenaUser {
  id: number;
  slug: string;
  name: string;
}

// Pass token: null for anonymous requests (public reads need no auth).
export async function arenaFetch<T>(
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${ARENA_API}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Are.na API ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function getCurrentUser(token: string): Promise<ArenaUser> {
  return arenaFetch<ArenaUser>("/me", token);
}
