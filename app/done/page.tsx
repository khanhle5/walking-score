"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScoreCanvas from "@/app/score-canvas";
import { formatDistance, formatDuration } from "@/lib/format";
import { encodePoints, encodeTimes } from "@/lib/points";
import { renderScorePng } from "@/lib/render";
import { playWalk, type Performance } from "@/lib/sonify";
import { clearWalk, loadWalk, type Walk } from "@/lib/walk-store";

type SaveState =
  | { s: "idle" }
  | { s: "saving" }
  | { s: "saved"; url: string; id: number }
  | { s: "error"; message: string };

export default function DonePage() {
  const router = useRouter();
  const [walk, setWalk] = useState<Walk | null | undefined>(undefined);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const [save, setSave] = useState<SaveState>({ s: "idle" });
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

  useEffect(() => {
    const w = loadWalk();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side, after mount
    setWalk(w);
    if (w && w.points.length > 1) {
      renderScorePng(w.points).then(setPngBlob);
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
      <ScoreCanvas points={walk.points} performance={performance} className="score-canvas" />
      <p className="label">
        {new Date(walk.startedAt).toLocaleDateString()} · {formatDuration(durationS)} ·{" "}
        {formatDistance(walk.distanceM)} · {walk.points.length} points
      </p>
      {save.s === "saved" ? (
        <>
          <p className="label">Saved to Are.na</p>
          <Link className="button" href={`/walk/${save.id}`}>
            View your walk →
          </Link>
          <a className="label" href={save.url} target="_blank" rel="noreferrer">
            View on Are.na →
          </a>
        </>
      ) : (
        <>
          <input
            className="input"
            maxLength={100}
            placeholder="Title this walk (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className="button"
            disabled={!pngBlob || save.s === "saving"}
            onClick={async () => {
              if (!pngBlob) return;
              setSave({ s: "saving" });
              const fd = new FormData();
              fd.append("image", pngBlob, "walk.png");
              fd.append("title", title.trim());
              fd.append("startedAt", walk.startedAt);
              fd.append("endedAt", walk.endedAt ?? "");
              fd.append("distanceM", String(walk.distanceM));
              fd.append("pointCount", String(walk.points.length));
              fd.append("points", encodePoints(walk.points));
              // Walks recorded before times existed have no t — skip the stream.
              const hasTimes = walk.points.every((p) => Number.isFinite(p.t));
              fd.append("times", hasTimes ? encodeTimes(walk.points.map((p) => p.t)) : "");
              try {
                const res = await fetch("/api/walks", { method: "POST", body: fd });
                const body = await res.json().catch(() => null);
                if (!res.ok) {
                  setSave({ s: "error", message: body?.error ?? `Upload failed (${res.status})` });
                  return;
                }
                clearWalk();
                setSave({ s: "saved", url: body.url, id: body.id });
              } catch {
                setSave({ s: "error", message: "Network error — your walk is still on this device, try again" });
              }
            }}
          >
            {save.s === "saving" ? "Saving…" : "Save to Are.na"}
          </button>
        </>
      )}
      {save.s === "error" && (
        <p className="label" role="alert">
          {save.message}
        </p>
      )}
      <button
        className="button button--ghost"
        onClick={() => {
          if (performance) {
            stopPlayback();
            return;
          }
          const p = playWalk(walk.points);
          if (!p) return;
          performanceRef.current = p;
          setPerformance(p);
          playTimeoutRef.current = window.setTimeout(stopPlayback, (p.durationS + 0.2) * 1000);
        }}
      >
        {performance ? "Stop" : "Play (30s)"}
      </button>
      <button
        className="button button--ghost"
        onClick={() => {
          stopPlayback();
          clearWalk();
          router.push("/walk");
        }}
      >
        {save.s === "saved" ? "Walk again" : "Discard"}
      </button>
    </main>
  );
}
