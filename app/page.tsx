import Link from "next/link";
import { getCurrentUser } from "@/lib/arena";
import { getToken } from "@/lib/session";
import { fetchWalks, type GalleryWalk } from "@/lib/walks";
import WalkGallery from "./walk-gallery";

export default async function Home() {
  const token = await getToken();
  let name: string | null = null;
  if (token) {
    try {
      name = (await getCurrentUser(token)).name;
    } catch {
      // Stale or revoked token — treat as signed out.
    }
  }

  // The walks channel is private, so the gallery is only shown when signed in.
  let walks: GalleryWalk[] = [];
  if (name) {
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
      {name ? (
        <>
          <p className="label">Signed in as {name}</p>
          <Link href="/walk">Start a walk →</Link>
          <WalkGallery walks={walks} />
        </>
      ) : (
        <a href="/api/auth/login">Sign in with Are.na</a>
      )}
    </main>
  );
}
