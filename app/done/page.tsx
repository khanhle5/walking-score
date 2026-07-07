"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistance, formatDuration } from "@/lib/format";
import { renderScorePng } from "@/lib/render";
import { playWalk, type Performance } from "@/lib/sonify";
import { clearWalk, loadWalk, type Walk } from "@/lib/walk-store";

export default function DonePage() {
  const router = useRouter();
  const [walk, setWalk] = useState<Walk | null | undefined>(undefined);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const performanceRef = useRef<Performance | null>(null);
  const playTimeoutRef = useRef<number | null>(null);

  const stopPlayback = () => {
    performanceRef.current?.stop();
    performanceRef.current = null;
    if (playTimeoutRef.current !== null) window.clearTimeout(playTimeoutRef.current);
    playTimeoutRef.current = null;
    setPlaying(false);
  };

  // Stop audio on unmount.
  useEffect(() => stopPlayback, []);

  useEffect(() => {
    const w = loadWalk();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side, after mount
    setWalk(w);
    if (w && w.points.length > 1) {
      let url: string | null = null;
      renderScorePng(w.points).then((blob) => {
        url = URL.createObjectURL(blob);
        setImgUrl(url);
      });
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
  }, []);

  if (walk === undefined) return null;

  if (!walk || walk.points.length < 2) {
    return (
      <main>
        <h1>Your score</h1>
        <p>No finished walk yet.</p>
        <Link href="/walk">Start one →</Link>
      </main>
    );
  }

  const durationS = walk.endedAt
    ? (Date.parse(walk.endedAt) - Date.parse(walk.startedAt)) / 1000
    : 0;

  return (
    <main>
      <h1>Your score</h1>
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL of the exact PNG that uploads
        <img src={imgUrl} alt="Your walk as a score" className="score-canvas" />
      )}
      <p className="label">
        {new Date(walk.startedAt).toLocaleDateString()} · {formatDuration(durationS)} ·{" "}
        {formatDistance(walk.distanceM)} · {walk.points.length} points
      </p>
      <button className="button" disabled title="Upload coming next">
        Save to Are.na
      </button>
      <button
        className="button button--ghost"
        onClick={() => {
          if (playing) {
            stopPlayback();
            return;
          }
          const performance = playWalk(walk.points);
          if (!performance) return;
          performanceRef.current = performance;
          setPlaying(true);
          playTimeoutRef.current = window.setTimeout(
            stopPlayback,
            (performance.durationS + 0.2) * 1000
          );
        }}
      >
        {playing ? "Stop" : "Play (30s)"}
      </button>
      <button
        className="button button--ghost"
        onClick={() => {
          stopPlayback();
          clearWalk();
          router.push("/walk");
        }}
      >
        Discard
      </button>
    </main>
  );
}
