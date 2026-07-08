import Link from "next/link";
import { getCurrentUser } from "@/lib/arena";
import { getToken } from "@/lib/session";
import { fetchWalks, type GalleryWalk } from "@/lib/walks";
import WalkGallery from "./walk-gallery";

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

  // The walks channel is private, so the gallery is only shown when signed in.
  let walks: GalleryWalk[] = [];
  if (username) {
    try {
      walks = await fetchWalks();
    } catch {
      // Gallery is decorative — the page works without it.
    }
  }

  return (
    <main>
      <h1>Walking Score</h1>
      <p>
        Record a walk. The route becomes a score.
      </p>
      {username ? (
        <>
          <p className="label">Signed in as {username}</p>
          <Link href="/walk">Start a walk →</Link>
          <WalkGallery walks={walks} />
        </>
      ) : (
        <a href="/api/auth/login">Sign in with Are.na</a>
      )}
    </main>
  );
}
