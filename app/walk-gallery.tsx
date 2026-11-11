"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistance } from "@/lib/format";
import { playWalk, type Performance } from "@/lib/sonify";
import { toTimedPoints } from "@/lib/timed-points";
import type { GalleryWalk } from "@/lib/walks";
import ScoreCanvas from "./score-canvas";
import dynamic from "next/dynamic";

const SaveMemory = dynamic(() => import("./save-memory"), { ssr: false });

function Tile({
  walk,
  performance,
  onToggle,
}: {
  walk: GalleryWalk;
  performance: Performance | null;
  onToggle: () => void;
}) {
  const points = useMemo(() => toTimedPoints(walk), [walk]);
  const [savingMemory, setSavingMemory] = useState(false);
  // Blocks are titled "<given title> (123m)", falling back to "Walk — <date>
  // (123m)". Show only given titles; the caption already has the distance.
  const title = walk.title.replace(/ \(\d+m\)$/, "");
  const hasTitle = title !== "" && !/^Walk — \d{4}-\d{2}-\d{2}$/.test(title);
  return (
    <figure className="tile">
      <Link href={`/walk/${walk.id}`}>
        <ScoreCanvas points={points} performance={performance} className="tile-canvas" />
      </Link>
      <figcaption className="label">
        {hasTitle && <div>{title}</div>}
        <a href={walk.url} target="_blank" rel="noreferrer">
          {walk.walker}
        </a>
        {" · "}
        {formatDistance(walk.distanceM)}
        {" · "}
        <button className="tile-play" onClick={onToggle}>
          {performance ? "stop" : "play"}
        </button>
        <div><button className="tile-memory" type="button" onClick={() => setSavingMemory(true)}>Lưu sang Memory</button></div>
      </figcaption>
      {savingMemory && <SaveMemory walk={walk} onClose={() => setSavingMemory(false)} />}
    </figure>
  );
}

export default function WalkGallery({ walks }: { walks: GalleryWalk[] }) {
  const [playing, setPlaying] = useState<{ id: number; performance: Performance } | null>(null);
  const playingRef = useRef<Performance | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopAll = () => {
    playingRef.current?.stop();
    playingRef.current = null;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setPlaying(null);
  };

  // Stop audio on unmount.
  useEffect(() => stopAll, []);

  if (walks.length === 0) return null;

  const toggle = (walk: GalleryWalk) => {
    const wasPlaying = playing?.id === walk.id;
    stopAll();
    if (wasPlaying) return;
    const performance = playWalk(toTimedPoints(walk));
    if (!performance) return;
    playingRef.current = performance;
    setPlaying({ id: walk.id, performance });
    timeoutRef.current = window.setTimeout(stopAll, (performance.durationS + 0.2) * 1000);
  };

  return (
    <section className="gallery">
      {walks.map((walk) => (
        <Tile
          key={walk.id}
          walk={walk}
          performance={playing?.id === walk.id ? playing.performance : null}
          onToggle={() => toggle(walk)}
        />
      ))}
    </section>
  );
}
