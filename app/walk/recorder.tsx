"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startFakeGps } from "@/lib/fake-gps";
import { formatDistance, formatDuration } from "@/lib/format";
import { makeProjector, type LatLng, type TimedXY, type XY } from "@/lib/geo";
import { drawScore } from "@/lib/render";
import { clearWalk, saveWalk } from "@/lib/walk-store";

const MAX_ACCURACY_M = 35; // drop fixes with worse GPS accuracy
const MIN_STEP_M = 3; // drop fixes closer than this to the last kept point (jitter)
const ANCHOR_ACCURACY_M = 20; // don't start the walk until GPS has settled this far

export default function Recorder() {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<TimedXY[]>([]);
  const projectRef = useRef<((p: LatLng) => XY) | null>(null);
  const firstFixMsRef = useRef(0);
  const distanceRef = useRef(0);
  const startedAtRef = useRef("");
  const watchIdRef = useRef<number | null>(null);
  const stopFakeRef = useRef<(() => void) | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) drawScore(ctx, pointsRef.current, canvas.width, canvas.height);
  }, []);

  const persist = useCallback((endedAt: string | null) => {
    saveWalk({
      startedAt: startedAtRef.current,
      endedAt,
      points: pointsRef.current,
      distanceM: distanceRef.current,
    });
  }, []);

  const onFix = useCallback(
    (lat: number, lng: number, accuracy: number | null) => {
      if (accuracy !== null && accuracy > MAX_ACCURACY_M) return;
      let p: XY;
      if (!projectRef.current) {
        // GPS drifts in a wandering cluster until the lock settles, which draws
        // a knot/spiral at the start of the line — hold out for a tight fix
        // before anchoring the walk.
        if (accuracy !== null && accuracy > ANCHOR_ACCURACY_M) return;
        // First fix anchors the walk in space and time; lat/lng is not kept
        // beyond the projector, and t counts seconds from here.
        projectRef.current = makeProjector({ lat, lng });
        firstFixMsRef.current = Date.now();
        p = { x: 0, y: 0 };
      } else {
        p = projectRef.current({ lat, lng });
        const last = pointsRef.current[pointsRef.current.length - 1];
        const seg = Math.hypot(p.x - last.x, p.y - last.y);
        if (seg < MIN_STEP_M) return;
        distanceRef.current += seg;
      }
      pointsRef.current.push({ ...p, t: (Date.now() - firstFixMsRef.current) / 1000 });
      setPointCount(pointsRef.current.length);
      setDistanceM(distanceRef.current);
      if (pointsRef.current.length % 10 === 0) persist(null);
      redraw();
    },
    [persist, redraw]
  );

  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Not supported or denied — recording still works while the screen is on.
    }
  }, []);

  const teardown = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    stopFakeRef.current?.();
    stopFakeRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const begin = useCallback(
    (source: "gps" | "fake") => {
      if (recording) return;
      pointsRef.current = [];
      projectRef.current = null;
      distanceRef.current = 0;
      startedAtRef.current = new Date().toISOString();
      setPointCount(0);
      setDistanceM(0);
      setElapsedS(0);
      setMessage(null);
      setRecording(true);
      acquireWakeLock();

      if (source === "fake") {
        stopFakeRef.current = startFakeGps(onFix);
        return;
      }
      if (!("geolocation" in navigator)) {
        setMessage("This browser has no geolocation.");
        setRecording(false);
        return;
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => onFix(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            teardown();
            setRecording(false);
            setMessage("Location permission denied — the recorder needs GPS.");
          } else {
            setMessage("GPS signal lost — still trying…");
          }
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    },
    [recording, acquireWakeLock, onFix, teardown]
  );

  const stop = useCallback(() => {
    if (finishing) return;
    teardown();
    if (pointsRef.current.length < 2) {
      setRecording(false);
      clearWalk();
      setMessage("Not enough movement to make a score — try a longer walk.");
      return;
    }
    // Keep showing the recording view until /done takes over — flipping back to
    // the idle screen here flashes it during the navigation.
    setFinishing(true);
    persist(new Date().toISOString());
    router.push("/done");
  }, [finishing, teardown, persist, router]);

  // Prefetch the destination so the stop → /done handoff is instant.
  useEffect(() => {
    if (recording) router.prefetch("/done");
  }, [recording, router]);

  // The wake lock is released whenever the tab is hidden; take it back on return.
  useEffect(() => {
    if (!recording) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [recording, acquireWakeLock]);

  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.parse(startedAtRef.current);
    const id = window.setInterval(
      () => setElapsedS(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => teardown, [teardown]);

  if (!recording) {
    return (
      <main>
        <p>
          Take a walk.
          <br />
          Keep your phone&rsquo;s screen on (the recording will stop if it
          goes to sleep).
          <br />
          The route you take will become a score.
        </p>
        {message && (
          <p className="label" role="status">
            {message}
          </p>
        )}
        <button className="button" onClick={() => begin("gps")}>
          Start walking
        </button>
        {process.env.NODE_ENV === "development" && (
          <button className="button button--ghost" onClick={() => begin("fake")}>
            Simulate a walk (dev)
          </button>
        )}
        <p className="label copy">
          Note: GPS coordinates are never saved. Before anything uploads, the
          walk is scrubbed into an abstract coordinate system, which is
          measured in meters starting from wherever you began.
        </p>
      </main>
    );
  }

  return (
    <main>
      <canvas ref={canvasRef} className="score-canvas" />
      <p className="label" role="status">
        {pointCount === 0
          ? "Waiting for GPS…"
          : `${formatDuration(elapsedS)} · ${formatDistance(distanceM)} · ${pointCount} points`}
      </p>
      {message && <p className="label">{message}</p>}
      <button className="button" onClick={stop} disabled={finishing}>
        {finishing ? "Saving…" : "Stop"}
      </button>
    </main>
  );
}
