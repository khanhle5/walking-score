"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistance } from "@/lib/format";
import { playWalk, type Performance } from "@/lib/sonify";
import { toTimedPoints } from "@/lib/timed-points";
import type { GalleryWalk } from "@/lib/walks";
import ScoreCanvas from "./score-canvas";
import dynamic from "next/dynamic";
import { onAuthStateChanged } from "firebase/auth";
import { mindstampsAuth, mindstampsConfigValid } from "@/lib/mindstamps";
import { memoryUrl, type MemoryLinks } from "@/lib/memory-links";

const FindMemories = dynamic(() => import("./find-memories"), { ssr: false });
const SaveMemory = dynamic(() => import("./save-memory"), { ssr: false });

function Tile({
  walk,
  performance,
  onToggle,
  memoryIds,
  onSaved,
}: {
  walk: GalleryWalk;
  performance: Performance | null;
  onToggle: () => void;
  memoryIds: string[];
  onSaved: (uid: string, id: string) => void;
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
        {memoryIds.map((id, index) => <div key={id}><a className="tile-memory tile-memory-link" href={memoryUrl(id)} target="_blank" rel="noreferrer">Xem bên Memory{memoryIds.length > 1 ? ` ${index + 1}` : ""} ↗</a></div>)}
        <div><button className="tile-memory" type="button" onClick={() => setSavingMemory(true)}>Lưu sang Memory</button></div>
      </figcaption>
      {savingMemory && <SaveMemory walk={walk} onSaved={onSaved} onClose={() => setSavingMemory(false)} />}
    </figure>
  );
}

export default function WalkGallery({ walks }: { walks: GalleryWalk[] }) {
  const [findingMemories, setFindingMemories] = useState(false);
  const [memoryLinks, setMemoryLinks] = useState<MemoryLinks>({});
  const [lookupMessage, setLookupMessage] = useState("");
  const ownerRef = useRef<string | null>(null);
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

  useEffect(() => {
    if (!mindstampsConfigValid) return;
    return onAuthStateChanged(mindstampsAuth, (user) => {
      if (ownerRef.current && ownerRef.current !== user?.uid) {
        ownerRef.current = null;
        setMemoryLinks({});
        setLookupMessage("");
      }
    });
  }, []);

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
    <>
      <div className="memory-lookup label">
        <button className="tile-memory" type="button" onClick={() => setFindingMemories(true)}>Tìm Memory đã lưu</button>
        {lookupMessage && <p role="status">{lookupMessage}</p>}
      </div>
      {findingMemories && <FindMemories walks={walks} onClose={() => setFindingMemories(false)} onFound={(uid, links) => {
        ownerRef.current = uid;
        setMemoryLinks(links);
        const count = Object.values(links).reduce((total, ids) => total + ids.length, 0);
        setLookupMessage(count ? `Đã tìm thấy ${count} Memory cho các chuyến đi đang hiển thị.` : "Không tìm thấy Memory tương ứng trong tài khoản này.");
      }} />}
      <section className="gallery">
      {walks.map((walk) => (
        <Tile
          key={walk.id}
          walk={walk}
          performance={playing?.id === walk.id ? playing.performance : null}
          onToggle={() => toggle(walk)}
          memoryIds={memoryLinks[walk.id] || []}
          onSaved={(uid, id) => {
            const sameOwner = ownerRef.current === uid;
            ownerRef.current = uid;
            setLookupMessage("");
            setMemoryLinks((previous) => {
              const links = sameOwner ? previous : {};
              return { ...links, [walk.id]: [...new Set([...(links[walk.id] || []), id])] };
            });
          }}
        />
      ))}
      </section>
    </>
  );
}
