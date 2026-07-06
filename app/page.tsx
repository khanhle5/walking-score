import Link from "next/link";
import { getCurrentUser } from "@/lib/arena";
import { getToken } from "@/lib/session";

export default async function Home() {
  const token = await getToken();
  let username: string | null = null;
  if (token) {
    try {
      username = (await getCurrentUser(token)).username;
    } catch {
      // Stale or revoked token — treat as signed out.
    }
  }

  return (
    <main>
      <h1>Walk as Score</h1>
      <p>
        Record a walk. The route becomes a score —<br />a black line on a white
        page, saved to Are.na.
      </p>
      {username ? (
        <>
          <p className="label">Signed in as {username}</p>
          <Link href="/walk">Start a walk →</Link>
        </>
      ) : (
        <a href="/api/auth/login">Sign in with Are.na</a>
      )}
    </main>
  );
}
