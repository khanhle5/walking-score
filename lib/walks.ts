import { arenaFetch } from "./arena";

// Server-side: read with the current viewer’s token when signed in, or
// anonymously for public channels. Scores are redrawn from block metadata.

export interface GalleryWalk {
  id: number;
  url: string;
  title: string;
  walker: string;
  startedAt: string;
  durationS: number;
  distanceM: number;
  points: string; // encoded, reassembled from metadata chunks
  times: string; // encoded, "" when the walk predates time capture
}

type BlockMetadata = Record<string, string | number | boolean | null>;

interface WalkBlock {
  id: number;
  title?: string | null;
  metadata?: BlockMetadata | null;
}

interface ContentsResponse {
  data: WalkBlock[];
}

function joinChunks(metadata: BlockMetadata, prefix: string): string {
  const count = Number(metadata[`${prefix}_chunks`] ?? 0);
  let joined = "";
  for (let i = 0; i < count; i++) {
    joined += String(metadata[`${prefix}_${i}`] ?? "");
  }
  return joined;
}

function toGalleryWalk(block: WalkBlock): GalleryWalk | null {
  const m = block.metadata;
  if (!m || m.app !== "walk-as-score") return null;
  const points = joinChunks(m, "points");
  if (!points) return null;
  return {
    id: block.id,
    url: `https://www.are.na/block/${block.id}`,
    title: String(block.title ?? ""),
    walker: String(m.walker ?? ""),
    startedAt: String(m.started_at ?? ""),
    durationS: Number(m.duration_s ?? 0),
    distanceM: Number(m.distance_m ?? 0),
    points,
    times: joinChunks(m, "times"),
  };
}

export async function fetchWalks(token: string | null): Promise<GalleryWalk[]> {
  const channel = process.env.ARENA_WALKS_CHANNEL;
  if (!channel) return [];

  const res = await arenaFetch<ContentsResponse>(
    `/channels/${encodeURIComponent(channel)}/contents?per=100&sort=created_at_desc`,
    token,
    { cache: "no-store" }
  );

  const walks: GalleryWalk[] = [];
  for (const block of res.data) {
    const walk = toGalleryWalk(block);
    if (walk) walks.push(walk);
  }
  return walks;
}

export async function getWalk(id: number, token: string | null): Promise<GalleryWalk | null> {
  let block: WalkBlock;
  try {
    block = await arenaFetch<WalkBlock>(`/blocks/${id}`, token, { cache: "no-store" });
  } catch {
    return null;
  }
  return toGalleryWalk(block);
}
