import { arenaFetch } from "./arena";

// Server-side only: reads the walks channel with the service token and
// rebuilds each walk from block metadata (the image is never fetched — scores
// are redrawn client-side from the decoded points).

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

export async function fetchWalks(): Promise<GalleryWalk[]> {
  const token = process.env.ARENA_SERVICE_TOKEN;
  const channel = process.env.ARENA_WALKS_CHANNEL;
  if (!token || !channel) return [];

  const res = await arenaFetch<ContentsResponse>(
    `/channels/${encodeURIComponent(channel)}/contents?per=100&sort=created_at_desc`,
    token
  );

  const walks: GalleryWalk[] = [];
  for (const block of res.data) {
    const walk = toGalleryWalk(block);
    if (walk) walks.push(walk);
  }
  return walks;
}

export async function getWalk(id: number): Promise<GalleryWalk | null> {
  const token = process.env.ARENA_SERVICE_TOKEN;
  if (!token) return null;

  let block: WalkBlock;
  try {
    block = await arenaFetch<WalkBlock>(`/blocks/${id}`, token);
  } catch {
    return null;
  }
  return toGalleryWalk(block);
}
