import type { GalleryWalk } from "./walks";
import { formatDistance, formatDuration } from "./format";

// Only the viewer-provided place is stored; Walking Score has no absolute GPS.
export function parseMemoryLocation(latText: string, lngText: string, name: string) {
  if (!latText.trim() || !lngText.trim() || !name.trim()) {
    throw new Error("Hãy chọn điểm trên bản đồ và nhập tên địa điểm.");
  }
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("Vĩ độ phải từ -90 đến 90 và kinh độ từ -180 đến 180.");
  }
  return { lat, lng, name: name.trim() };
}

export function memoryFields(walk: GalleryWalk, location: ReturnType<typeof parseMemoryLocation>, imageData: string, userId: string) {
  return {
    title: walk.title.trim() || `Walk — ${walk.startedAt.slice(0, 10) || "score"}`,
    story: [
      `Walking Score · ${walk.startedAt.slice(0, 10)}`,
      `${formatDistance(walk.distanceM)} · ${formatDuration(walk.durationS)}`,
      `Are.na: ${walk.url}`,
    ].join("\n"),
    location,
    imageData,
    imageType: "photo",
    videoUrl: null,
    videoLearningSpec: null,
    learningGameVersions: [],
    userId,
    createdAt: new Date(),
  };
}
