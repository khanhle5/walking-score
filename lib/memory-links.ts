import type { GalleryWalk } from "./walks";

export type MemoryLinks = Record<number, string[]>;

// Prefer the explicit field in new exports. Older exports have the block URL on
// its own line in the story. Never match just a substring or another user's doc.
export function addMemoryLink(links: MemoryLinks, walks: GalleryWalk[], uid: string, id: string, data: { userId?: unknown; story?: unknown; walkingScoreUrl?: unknown }) {
  if (data.userId !== uid || !id) return;
  const urls = typeof data.walkingScoreUrl === "string"
    ? [data.walkingScoreUrl]
    : typeof data.story === "string"
      ? data.story.split(/\r?\n/).filter((line) => line.startsWith("Are.na: ")).map((line) => line.slice(8).trim())
      : [];
  for (const walk of walks) {
    if (urls.includes(walk.url) && !links[walk.id]?.includes(id)) {
      (links[walk.id] ||= []).push(id);
    }
  }
}

export function memoryUrl(id: string) {
  return `https://zofovn.vercel.app/#home?memory=${encodeURIComponent(id)}`;
}
