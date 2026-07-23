import type { TimedXY } from "./geo";
import { decodePoints, decodeTimes } from "./points";
import type { GalleryWalk } from "./walks";

export function toTimedPoints(walk: GalleryWalk): TimedXY[] {
  const points = decodePoints(walk.points);
  const times = walk.times ? decodeTimes(walk.times) : null;
  // Walks without a time stream play at uniform pace.
  return points.map((p, i) => ({ ...p, t: times?.[i] ?? i }));
}
