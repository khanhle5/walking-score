"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistance } from "@/lib/format";
import type { TimedXY } from "@/lib/geo";
import { decodePoints, decodeTimes } from "@/lib/points";
import { drawScore } from "@/lib/render";
import { playWalk, type Performance } from "@/lib/sonify";
import type { GalleryWalk } from "@/lib/walks";

function toTimedPoints(walk: GalleryWalk): TimedXY[] {
  const points = decodePoints(walk.points);
  const times = walk.times ? decodeTimes(walk.times) : null;
  // Walks without a time stream play at uniform pace.
  return points.map((p, i) => ({ ...p, t: times?.[i] ?? i }));
}

function Tile({
  walk,
  playing,
  onToggle,
}: {
  walk: GalleryWalk;
  playing: boolean;
  onToggle: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) drawScore(ctx, decodePoints(walk.points), canvas.width, canvas.height);
  }, [walk.points]);

  return (
    <figure className="tile">
      <canvas ref={canvasRef} className="tile-canvas" />
      <figcaption className="label">
        <a href={walk.url} target="_blank" rel="noreferrer">
          {walk.walker}
        </a>
        {" · "}
        {formatDistance(walk.distanceM)}
        {" · "}
        <button className="tile-play" onClick={onToggle}>
          {playing ? "stop" : "play"}
        </button>
      </figcaption>
    </figure>
  );
}

export default function WalkGallery({ walks }: { walks: GalleryWalk[] }) {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const performanceRef = useRef<Performance | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopAll = () => {
    performanceRef.current?.stop();
    performanceRef.current = null;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setPlayingId(null);
  };

  // Stop audio on unmount.
  useEffect(() => stopAll, []);

  if (walks.length === 0) return null;

  const toggle = (walk: GalleryWalk) => {
    const wasPlaying = playingId === walk.id;
    stopAll();
    if (wasPlaying) return;
    const performance = playWalk(toTimedPoints(walk));
    if (!performance) return;
    performanceRef.current = performance;
    setPlayingId(walk.id);
    timeoutRef.current = window.setTimeout(stopAll, (performance.durationS + 0.2) * 1000);
  };

  return (
    <section className="gallery">
      {walks.map((walk) => (
        <Tile
          key={walk.id}
          walk={walk}
          playing={playingId === walk.id}
          onToggle={() => toggle(walk)}
        />
      ))}
    </section>
  );
}
