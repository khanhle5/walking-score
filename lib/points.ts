// Encoding for walk points stored in Are.na block metadata.
//
// The Google polyline algorithm (delta + zigzag + base63 varint), but applied to
// (x, y) meter offsets from the walk's start at 0.1m precision instead of lat/lng.
// We own both ends of this codec; the format is:
//   - per point, x then y, each delta-encoded against the previous point
//   - value -> round(v * 10) -> zigzag -> 5-bit chunks, low first, +63, bit 6 = more
// Metadata string values max out at 2000 chars, so the encoded string is chunked
// into points_0..points_n keys; decoding concatenates chunks first (deltas run
// across chunk boundaries).

import type { XY } from "./geo";

const PRECISION = 10; // 0.1m

function encodeValue(value: number, out: string[]): void {
  let v = value < 0 ? ~(value << 1) : value << 1;
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  out.push(String.fromCharCode(v + 63));
}

export function encodePoints(points: XY[]): string {
  const out: string[] = [];
  let prevX = 0;
  let prevY = 0;
  for (const p of points) {
    const x = Math.round(p.x * PRECISION);
    const y = Math.round(p.y * PRECISION);
    encodeValue(x - prevX, out);
    encodeValue(y - prevY, out);
    prevX = x;
    prevY = y;
  }
  return out.join("");
}

export function decodePoints(encoded: string): XY[] {
  const points: XY[] = [];
  let i = 0;
  let x = 0;
  let y = 0;
  const readValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    x += readValue();
    y += readValue();
    points.push({ x: x / PRECISION, y: y / PRECISION });
  }
  return points;
}

// Split for metadata keys points_0..points_n (string values max 2000 chars).
export function chunkEncoded(encoded: string, maxLen = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += maxLen) {
    chunks.push(encoded.slice(i, i + maxLen));
  }
  return chunks.length > 0 ? chunks : [""];
}
