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

// A recorded point: position in meters from the first fix, time in seconds from
// the first fix. Space and time are both normalized to the walk's own origin.
export interface TimedXY extends XY {
  t: number;
}

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

// Equirectangular projection anchored at an origin point. Walks span a few km at
// most, where this is accurate to well under a meter — no need for anything fancier.
// The recorder projects each fix as it arrives and discards the lat/lng immediately.
export function makeProjector(origin: LatLng): (p: LatLng) => XY {
  const cosLat = Math.cos(origin.lat * DEG);
  return (p) => ({
    x: (p.lng - origin.lng) * DEG * cosLat * EARTH_RADIUS_M,
    y: (p.lat - origin.lat) * DEG * EARTH_RADIUS_M,
  });
}

export function toLocalXY(points: LatLng[]): XY[] {
  if (points.length === 0) return [];
  const project = makeProjector(points[0]);
  return points.map(project);
}

export function pathDistanceM(points: XY[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return d;
}
