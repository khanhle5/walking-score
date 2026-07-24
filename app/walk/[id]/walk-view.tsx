"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ScoreCanvas from "@/app/score-canvas";
import { formatDistance, formatDuration } from "@/lib/format";
import { playWalk, type Performance } from "@/lib/sonify";
import { toTimedPoints } from "@/lib/timed-points";
import type { GalleryWalk } from "@/lib/walks";

export default function WalkView({ walk }: { walk: GalleryWalk }) {
  const points = useMemo(() => toTimedPoints(walk), [walk]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const performanceRef = useRef<Performance | null>(null);
  const playTimeoutRef = useRef<number | null>(null);

  const stopPlayback = () => {
    performanceRef.current?.stop();
    performanceRef.current = null;
    if (playTimeoutRef.current !== null) window.clearTimeout(playTimeoutRef.current);
    playTimeoutRef.current = null;
    setPerformance(null);
  };

  // Stop audio on unmount.
  useEffect(() => stopPlayback, []);

  return (
    <main>
      <h1>{walk.title || "Walk"}</h1>
      <ScoreCanvas points={points} performance={performance} className="score-canvas" />
      <p className="label">
        {walk.startedAt.slice(0, 10)} · {formatDuration(walk.durationS)} ·{" "}
        {formatDistance(walk.distanceM)} · {points.length} points · {walk.walker}
      </p>
      <button
        className="button button--ghost"
        onClick={() => {
          if (performance) {
            stopPlayback();
            return;
          }
          const p = playWalk(points);
          if (!p) return;
          performanceRef.current = p;
          setPerformance(p);
          playTimeoutRef.current = window.setTimeout(stopPlayback, (p.durationS + 0.2) * 1000);
        }}
      >
        {performance ? "Stop" : "Play (30s)"}
      </button>
      <a className="label" href={walk.url} target="_blank" rel="noreferrer">
        View on Are.na →
      </a>
      <Link className="button button--ghost" href="/">
        ← Back to all scores
      </Link>
    </main>
  );
}
