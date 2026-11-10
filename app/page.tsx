import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/arena";
import { isMobileUA } from "@/lib/device";
import { getToken } from "@/lib/session";
import { fetchWalks, type GalleryWalk } from "@/lib/walks";
import WalkGallery from "./walk-gallery";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const authError = (await searchParams).error === "auth";
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

  let walks: GalleryWalk[] = [];
  let galleryError = false;
  try {
    // Only use a verified session; signed-out visitors can still see public walks.
    walks = await fetchWalks(name ? token : null);
  } catch {
    galleryError = true;
  }

  return (
    <main className="home">
      <header className="home-header">
        <h1>walking-score.are.na</h1>
        {name && <p className="label">Signed in as {name}</p>}
      </header>
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
          to secure an advantage; to gain points in a game; to keep record or
          account; a cut, notch, or groove; a group of twenty; a musical
          composition; a grudge.
        </span>
      </p>
      <p className="copy">
        For the community element of this year&rsquo;s edition, we&rsquo;d like
        you to take a walk. The route you take will become a score.
      </p>
      {authError && !name && (
        <p className="copy" role="alert">
          Sign-in was not completed. Please try again.
        </p>
      )}
      {!name && (
        <a className="button" href="/api/auth/login">
          Sign in with Are.na to add your score
        </a>
      )}
      {name && canRecord && (
        <Link className="button button--blue" href="/walk">
          Start a walk →
        </Link>
      )}
      {!isMobile && (
        <p className="label copy">
          You&apos;re on a computer — {name ? "open this" : "visit"} on your
          phone to record a walk.
        </p>
      )}
      {galleryError ? (
        <p className="label copy" role="status">
          Could not load walks from Are.na. Check the channel and your access,
          then try again.
        </p>
      ) : walks.length === 0 ? (
        <p className="label copy">No walks to show yet.</p>
      ) : (
        <WalkGallery walks={walks} />
      )}
    </main>
  );
}
