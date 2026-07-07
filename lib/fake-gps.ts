export type FixHandler = (lat: number, lng: number, accuracy: number | null) => void;

// Dev-only simulated walk for testing the recorder at a desk: walking pace with
// a wandering heading, a fix every 500ms. Goes through the same filtering and
// projection as real GPS.
export function startFakeGps(onFix: FixHandler): () => void {
  let lat = 40.7146;
  let lng = -73.9918;
  let heading = Math.random() * 2 * Math.PI;
  const id = window.setInterval(() => {
    heading += (Math.random() - 0.5) * 0.7;
    const stepM = 0.7 + Math.random() * 0.7; // ≈ 1.4–2.8 m/s at 2 fixes/s
    lat += (Math.cos(heading) * stepM) / 111320;
    lng += (Math.sin(heading) * stepM) / (111320 * Math.cos((lat * Math.PI) / 180));
    onFix(lat, lng, 5);
  }, 500);
  return () => window.clearInterval(id);
}
