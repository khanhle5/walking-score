import Link from "next/link";
import { headers } from "next/headers";
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

  // A hint, not a gate — recording wants a phone (GPS, walking with a screen).
  const ua = (await headers()).get("user-agent") ?? "";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);

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
    <main className="home">
      <h1>walking-score.are.na</h1>
      {name ? (
        <>
          <p className="label">Signed in as {name}</p>
          <Link href="/walk">Start a walk →</Link>
          {!isMobile && (
            <p className="label copy">
              You&apos;re on a computer — open this on your phone to record a walk.
            </p>
          )}
          <WalkGallery walks={walks} />
        </>
      ) : (
        <>
          <p className="copy">
            The theme for this year&rsquo;s{" "}
            <a
              href="https://www.are.na/editorial/open-call-for-pitches-for-the-are-na-annual-vol-8"
              target="_blank"
              rel="noreferrer"
            >
              Are.na Annual
            </a>{" "}
            is &ldquo;score&rdquo;
            as in to secure an advantage; to gain points in a game; to keep
            record or account; a cut, notch, or groove; a group of twenty; a
            musical composition; a grudge.
          </p>
          <p className="copy">
            For the community element of this years edition, we&rsquo;d like you to take a walk. The route you take will become a score.
          </p>
          <a className="button" href="/api/auth/login">
            Sign in with Are.na
          </a>
          <p className="label copy">
            Note: GPS coordinates are never saved. Before anything uploads, the
            walk is scrubbed into an abstract coordinate system, which is measured in meters starting from wherever you began.
          </p>
          {!isMobile && (
            <p className="label copy">
              You&apos;re on a computer — visit on your phone to record a walk.
            </p>
          )}
        </>
      )}
    </main>
  );
}
