// Conversion from GPS coordinates to the walk's local space: (x, y) offsets in
// meters from the first point, x = east, y = north. Absolute lat/lng must never
// leave the device — everything downstream (rendering, storage) uses this space.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface XY {
  x: number;
  y: number;
}

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

// Equirectangular projection anchored at the first point. Walks span a few km at
// most, where this is accurate to well under a meter — no need for anything fancier.
export function toLocalXY(points: LatLng[]): XY[] {
  if (points.length === 0) return [];
  const origin = points[0];
  const cosLat = Math.cos(origin.lat * DEG);
  return points.map((p) => ({
    x: (p.lng - origin.lng) * DEG * cosLat * EARTH_RADIUS_M,
    y: (p.lat - origin.lat) * DEG * EARTH_RADIUS_M,
  }));
}

export function pathDistanceM(points: XY[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return d;
}
