import type { TimedXY } from "./geo";

// Prototype sonification: the walk as a harp. Each recorded point is a plucked
// note — pitch from y (north = up, ~3 octaves, snapped to a pentatonic scale so
// any path is consonant), stereo pan from x, timing from the walk's normalized
// time. Standing still records no points (the jitter filter drops them), so
// pauses in the walk are literal rests in the performance.

const MIDI_LOW = 45; // A2
const MIDI_HIGH = 81; // A5
const SCALE = [0, 2, 4, 7, 9]; // major pentatonic
const MAX_NOTES = 240; // keep long walks listenable
const MIN_GAP_S = 0.05; // don't stack notes closer than this in performance time
const NOTE_LEVEL = 0.22;
const DECAY_S = 1.4;

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Snap a continuous MIDI value to the nearest pentatonic degree.
function quantize(midi: number): number {
  const octave = Math.floor(midi / 12);
  const within = midi - octave * 12;
  let best = SCALE[0];
  let bestDist = Infinity;
  for (const degree of [...SCALE, SCALE[0] + 12]) {
    const d = Math.abs(within - degree);
    if (d < bestDist) {
      bestDist = d;
      best = degree;
    }
  }
  return octave * 12 + best;
}

export interface Performance {
  durationS: number;
  stop: () => void;
}

export function playWalk(points: TimedXY[], durationS = 30): Performance | null {
  if (points.length < 2) return null;
  // Walks saved before times existed have no t; nothing to perform.
  const totalT = points[points.length - 1].t;
  if (!Number.isFinite(totalT) || totalT <= 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const toMidi = (y: number) =>
    quantize(spanY > 0 ? MIDI_LOW + ((y - minY) / spanY) * (MIDI_HIGH - MIDI_LOW) : (MIDI_LOW + MIDI_HIGH) / 2);
  const toPan = (x: number) => (spanX > 0 ? ((x - minX) / spanX) * 2 - 1 : 0);

  // iOS mutes Web Audio when the ringer switch is on silent unless the audio
  // session is declared as playback (supported iOS 17+; harmless elsewhere).
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    // Older iOS — the ringer switch wins; nothing we can do from JS.
  }

  // Must be constructed inside a user gesture on iOS.
  const ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);

  const t0 = ctx.currentTime + 0.05;
  const stride = Math.max(1, Math.ceil(points.length / MAX_NOTES));
  let lastAt = -Infinity;
  for (let i = 0; i < points.length; i += stride) {
    const p = points[i];
    const at = t0 + (p.t / totalT) * durationS;
    if (at - lastAt < MIN_GAP_S) continue;
    lastAt = at;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    osc.type = "triangle";
    osc.frequency.value = midiToHz(toMidi(p.y));
    pan.pan.value = toPan(p.x);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(NOTE_LEVEL, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, at + DECAY_S);
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(master);
    osc.start(at);
    osc.stop(at + DECAY_S + 0.1);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    void ctx.close().catch(() => {});
  };

  return {
    durationS: durationS + DECAY_S,
    stop: close,
  };
}
