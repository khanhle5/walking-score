export type MapPoint = { lat: number; lng: number };
export type PlaceResult = MapPoint & { name: string };

// Mapbox renders wrapped world copies. Store the canonical longitude.
export function canonicalPoint(lat: number, lng: number): MapPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90) return null;
  return { lat, lng: lng >= -180 && lng <= 180 ? lng : ((lng + 180) % 360 + 360) % 360 - 180 };
}

// Treat search responses as untrusted; only usable point features reach the form.
export function parsePlaceResults(data: unknown): PlaceResult[] {
  const features = (data as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature): PlaceResult[] => {
    const coordinates = feature?.geometry?.coordinates;
    const name = feature?.properties?.full_address || feature?.properties?.name;
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number" || typeof name !== "string" || !name.trim()) return [];
    const point = canonicalPoint(coordinates[1], coordinates[0]);
    return point ? [{ ...point, name: name.trim().slice(0, 200) }] : [];
  });
}
