import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/arena";
import { isMobileUA } from "@/lib/device";
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

  const ua = (await headers()).get("user-agent") ?? "";
  const isMobile = isMobileUA(ua);
  // Recording is phone-only; dev mode stays open for the simulate-a-walk flow.
  const canRecord = isMobile || process.env.NODE_ENV === "development";

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
          {canRecord ? (
            <Link className="button button--blue" href="/walk">
              Start a walk →
            </Link>
          ) : (
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
            is &ldquo;score&rdquo; as in{" "}
            <span className="italic">
              to secure an advantage; to gain points in a game; to keep record
              or account; a cut, notch, or groove; a group of twenty; a musical
              composition; a grudge.
            </span>
          </p>
          <p className="copy">
            Take a walk.
            <br />
            Keep your phone&rsquo;s screen on (the recording will stop if it
            goes to sleep).
            <br />
            The route you take will become a score.
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
