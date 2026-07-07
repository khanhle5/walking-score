import type { TimedXY } from "./geo";

// The walk lives in localStorage from the first fixes until the upload is
// confirmed, so a crashed tab or accidental navigation never loses a walk.

export interface Walk {
  startedAt: string; // ISO 8601
  endedAt: string | null; // null while recording
  points: TimedXY[]; // meters and seconds from the first fix, x = east, y = north
  distanceM: number;
}

const KEY = "walk-as-score:walk";

export function saveWalk(walk: Walk): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(walk));
  } catch {
    // Storage full or blocked — recording continues in memory.
  }
}

export function loadWalk(): Walk | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Walk) : null;
  } catch {
    return null;
  }
}

export function clearWalk(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
