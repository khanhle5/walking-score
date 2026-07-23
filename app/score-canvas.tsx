"use client";

import { useEffect, useRef } from "react";
import type { TimedXY } from "@/lib/geo";
import { drawScore, projectScore } from "@/lib/render";
import { walkPositionAt, type Performance } from "@/lib/sonify";

// A score drawn to canvas, with a playhead dot while `performance` is live.
export default function ScoreCanvas({
  points,
  performance,
  className,
}: {
  points: TimedXY[];
  performance: Performance | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) drawScore(ctx, points, canvas.width, canvas.height);
  }, [points]);

  // While playing, redraw each frame with a dot at the audio clock's position
  // along the walk.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !performance) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const project = projectScore(points, canvas.width, canvas.height);
    const radius = Math.max(4, Math.min(canvas.width, canvas.height) / 60);
    let raf = requestAnimationFrame(function frame() {
      drawScore(ctx, points, canvas.width, canvas.height);
      const { x, y } = project(walkPositionAt(points, performance.progress()));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      raf = requestAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(raf);
      drawScore(ctx, points, canvas.width, canvas.height);
    };
  }, [points, performance]);

  return <canvas ref={canvasRef} className={className} />;
}
