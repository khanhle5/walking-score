// Encoding for walk points stored in Are.na block metadata.
//
// The Google polyline algorithm (delta + zigzag + base63 varint), but applied to
// the walk's own normalized space and time instead of lat/lng:
//   - points: (x, y) meter offsets from the first fix at 0.1m precision,
//     per point x then y, each delta-encoded against the previous point
//   - times: seconds from the first fix at 0.1s precision, one value per point
//   - value -> round(v * 10) -> zigzag -> 5-bit chunks, low first, +63, bit 6 = more
// Metadata string values max out at 2000 chars, so encoded streams are chunked
// into points_0..points_n / times_0..times_n keys; decoding concatenates chunks
// first (deltas run across chunk boundaries).

import type { XY } from "./geo";

const PRECISION = 10; // 0.1m for coordinates, 0.1s for times

function encodeValue(value: number, out: string[]): void {
  let v = value < 0 ? ~(value << 1) : value << 1;
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  out.push(String.fromCharCode(v + 63));
}

// Decodes a stream of varint values back to raw (still scaled) deltas. Callers
// accumulate: times sum the whole stream, points sum x and y separately.
function decodeDeltas(encoded: string): number[] {
  const deltas: number[] = [];
  let i = 0;
  while (i < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    deltas.push(result & 1 ? ~(result >> 1) : result >> 1);
  }
  return deltas;
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
  const deltas = decodeDeltas(encoded);
  const points: XY[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < deltas.length; i += 2) {
    x += deltas[i];
    y += deltas[i + 1];
    points.push({ x: x / PRECISION, y: y / PRECISION });
  }
  return points;
}

export function encodeTimes(times: number[]): string {
  const out: string[] = [];
  let prev = 0;
  for (const t of times) {
    const v = Math.round(t * PRECISION);
    encodeValue(v - prev, out);
    prev = v;
  }
  return out.join("");
}

export function decodeTimes(encoded: string): number[] {
  const times: number[] = [];
  let t = 0;
  for (const delta of decodeDeltas(encoded)) {
    t += delta;
    times.push(t / PRECISION);
  }
  return times;
}

// Split for metadata keys points_0..points_n / times_0..times_n.
export function chunkEncoded(encoded: string, maxLen = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += maxLen) {
    chunks.push(encoded.slice(i, i + maxLen));
  }
  return chunks.length > 0 ? chunks : [""];
}
