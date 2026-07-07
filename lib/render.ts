import type { XY } from "./geo";

export const EXPORT_SIZE = 2048;

// Draws the score: a black line on white, auto-fit with margins, north up.
// Used for both the live preview and the exported PNG, so what you watch
// while walking is exactly what uploads.
export function drawScore(
  ctx: CanvasRenderingContext2D,
  points: XY[],
  width: number,
  height: number
): void {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  if (points.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const margin = 0.12 * Math.min(width, height);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX > 0 ? (width - 2 * margin) / spanX : Infinity,
    spanY > 0 ? (height - 2 * margin) / spanY : Infinity
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const lineWidth = Math.max(2, Math.min(width, height) / 240);

  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // No movement yet (or a single point): the score is a dot.
  if (!Number.isFinite(scale)) {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, lineWidth, 0, 2 * Math.PI);
    ctx.fill();
    return;
  }

  // Canvas y grows downward; the walk's y is north.
  ctx.beginPath();
  ctx.moveTo(width / 2 + (points[0].x - cx) * scale, height / 2 - (points[0].y - cy) * scale);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(width / 2 + (points[i].x - cx) * scale, height / 2 - (points[i].y - cy) * scale);
  }
  ctx.stroke();
}

export function renderScorePng(points: XY[], size = EXPORT_SIZE): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas 2d context unavailable"));
  drawScore(ctx, points, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    )
  );
}
