<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Walk as Score

A mobile-first website for the Are.na Annual community element (2026 theme: **"score"**).
People sign in with Are.na, record a walk (like Strava), and the route is saved to an
Are.na channel as an image — a black abstract line on a white background. The raw GPS
point data is stored in the block's `metadata` so the walks can be reinterpreted later
(reperformed, replotted, printed in the Annual, etc.). A walk is a score; the image is
its notation.

## Decisions already made

- **Website, not a native app.** Zero-friction distribution (a URL in the Annual /
  newsletter), and browser geolocation is sufficient. Tradeoff we accepted: no
  background recording — the screen must stay on during a walk. We treat this as a
  feature (the score draws live while you walk) and use the Screen Wake Lock API to
  keep the phone awake.
- **Next.js (App Router), deployed on Vercel.** API routes handle the OAuth code
  exchange; everything else is client-side.
- **PNG output, not SVG.** Are.na does not accept SVG uploads (security). Render the
  route to a `<canvas>`, export PNG.
- **Point data lives in block `metadata`**, which the v3 API supports natively
  (see constraints below). Encode points as a polyline string, not raw JSON.
- **Design comes from [`@aredotna/tokens`](https://github.com/aredotna/tokens)** (on
  npm), Are.na's design tokens. The Areal variable font is loaded via
  `next/font/local` in `lib/fonts.ts` (axes: `"MONO" 0–100` for sans→mono — use the
  `.mono` class — and `slnt` for italics). **Labels and metadata are set in the mono
  axis** (`.mono`, usually with `--font-size-2`), matching are.na itself — think
  walk stats, timestamps, "signed in as", captions. Body text stays sans. CSS custom properties in `app/tokens.css`
  are **generated** from the package by `npm run tokens`
  (`scripts/generate-tokens-css.mjs`) — never edit that file or hand-copy token
  values; regenerate after updating the package. Light theme only: the score is a
  black line on white and the site follows. Headings are normal weight (Are.na
  convention).
- **No absolute location is ever stored — space and time are both normalized.**
  GPS is used live to draw the line, but before saving, points are converted to
  (x, y) offsets in meters from the walk's first fix, north-up, and each point's
  time is seconds from that first fix. Every walk lives in the same abstract frame
  starting at (0, 0) and t=0 — shape, scale, distance, and rhythm (where you
  lingered or hurried) survive; where on Earth and when on the clock do not
  (only `started_at` carries calendar time, like a date on a drawing). Raw lat/lng
  never leaves the device.

## Are.na API (v3) — what this app uses

Full spec: `https://api.are.na/v3/openapi` (YAML). Docs: https://www.are.na/developers
Base URL: `https://api.are.na/v3`. Auth: `Authorization: Bearer <token>`.

### OAuth

- Authorize: `https://www.are.na/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=write`
- Token: `POST https://api.are.na/v3/oauth/token` (form-encoded: `grant_type=authorization_code`,
  `client_id`, `client_secret`, `code`, `redirect_uri`)
- PKCE is supported for public clients, but since we have Next.js API routes we use the
  confidential authorization-code flow and keep the secret server-side.
- **Access tokens do not expire.** Store in an httpOnly encrypted cookie; no refresh logic needed.
- Register the app at https://www.are.na/oauth/applications
- Scope: `write` (create blocks/channels).

### Image upload flow (three steps)

1. `POST /v3/uploads/presign` with `{ files: [{ filename, content_type }] }` → returns
   presigned S3 PUT URLs (expire in 1 hour).
2. `PUT` the PNG bytes to the returned `upload_url` with matching `Content-Type` header.
3. `POST /v3/blocks` with `value` set to the S3 URL (`https://s3.amazonaws.com/arena_images-temp/<key>`).

### Creating the block

`POST /v3/blocks` body (JSON):

```json
{
  "value": "<s3 temp url>",
  "title": "Walk — <date>",
  "description": "optional, markdown",
  "metadata": { "...": "see below" },
  "channels": [{ "id": "<channel id or slug>" }]
}
```

### Metadata constraints (important)

- Keys: alphanumeric/underscore, max 40 chars. Max **50 keys**, **32KB total**.
- Values: scalars only (string/number/boolean); strings max **2000 chars** each.
- Merge semantics on update (`PUT /v3/blocks/{id}`): new keys added, existing updated,
  `null` deletes a key.

Planned metadata shape:

```
app: "walk-as-score"
schema_version: 1
started_at: "2026-07-06T14:03:00Z"   (ISO 8601, UTC)
duration_s: 2711
distance_m: 3480
point_count: 1355
points_0: "<encoded polyline chunk>"  (see encoding below)
points_1: "..."                       (chunk at ≤2000 chars; ~300 pts/chunk)
points_chunks: 2
times_0: "<encoded time chunk>"       (seconds from first fix, one per point)
times_chunks: 1
```

**Encoding** (implemented in `lib/points.ts`): the Google polyline algorithm
(delta + zigzag + base63 varint), applied to the walk's own normalized frame instead
of lat/lng. Points are (x, y) meter offsets from the first fix at 0.1m precision,
north-up, x = east, first point always (0, 0). Times are one value per point,
seconds from the first fix at 0.1s precision, first always 0 — pacing survives in
relative form for sonification/reperformance, with no clock time beyond `started_at`.
We own both encoder and decoder, so this is just a spec detail — documented in code.
~5–10 bytes/point for positions plus ~1–2 for times; a multi-hour walk fits within
32KB. Downsample (min-distance threshold or Douglas-Peucker) before encoding if needed.

## Architecture

- `app/` — Next.js App Router.
  - `/` — landing: what this is, sign-in button.
  - `/walk` — the recorder: big start/stop, live canvas drawing the line as you walk.
  - `/done` — preview the rendered score, confirm → upload → link to the block on Are.na.
  - `app/api/auth/*` — OAuth redirect + callback (code→token exchange, sets cookie).
  - `app/api/*` — thin proxies only where the token must stay server-side; prefer
    calling api.are.na directly from the client with the token where practical.
- **Recording**: `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`;
  filter points by `accuracy` (drop > ~30m) and minimum distance (~3–5m) to reduce GPS
  jitter. `navigator.wakeLock.request('screen')` while recording; re-acquire on
  `visibilitychange` (wake lock is released when the tab is hidden — recording pauses
  if the user leaves the tab; surface this in the UI).
- **Rendering**: project lat/lng with a simple equirectangular projection scaled by
  cos(mean latitude), normalize to fit a square canvas with margins, stroke a single
  black round-capped line on white. Export at 2048×2048 PNG. No map, no labels.
- **Where blocks go**: a shared community channel (e.g. `walk-as-score`) — must be
  open/collaborative so any authenticated member can connect to it. Optionally also
  let the person pick one of their own channels.

## Privacy

Solved structurally rather than with warnings: absolute coordinates are never
persisted anywhere (see decision above) — metadata contains only start-relative meter
offsets, so there is no location data to leak. The person still previews the rendered
score and explicitly confirms before anything uploads. Residual (accepted) risk: a
sufficiently distinctive route shape could in principle be matched against street
grids, but that is equally true of the image itself and is the reasonable line for an
art project.

## Build plan

1. ✅ **Scaffold**: `create-next-app` (TypeScript, App Router, no Tailwind).
2. ✅ **OAuth**: registered on are.na; env vars in `.env.local`; auth routes; cookie
   session; `/v3/me` on the landing page. Local dev runs `next dev --experimental-https`
   because Are.na requires https redirect URIs.
3. ✅ **Recorder** (`app/walk/recorder.tsx`): geolocation + wake lock + live canvas.
   Fixes with accuracy >35m are dropped; fixes <3m from the last kept point are
   dropped (GPS jitter). Dev-only "Simulate a walk" button streams fake fixes
   through the same pipeline. Walk persists to localStorage every 10 points.
4. ✅ **Renderer** (`lib/render.ts`): one `drawScore()` used by both the live preview
   and the 2048×2048 PNG export (`renderScorePng`), so the preview is the artifact.
5. **Upload**: presign → S3 PUT → create block with metadata → success screen linking
   to the block. (`/done` currently renders the PNG with a disabled upload button.)
6. **Polish**: error states (GPS denied, walk too short, upload failure with retry —
   keep points in localStorage until confirmed uploaded), visual design.
7. **Deploy**: Vercel, custom domain, register production redirect URI.

## Future ideas

- **Sonification — walks as playable scores (MIDI).** A prototype lives in
  `lib/sonify.ts` (Play button on /done): harp-like — every recorded point is a
  plucked note (triangle osc, fast attack, ~1.4s exponential decay), pitch = y over
  ~3 octaves snapped to major pentatonic, stereo pan = x, walk time normalized to a
  30s performance. Because the jitter filter records no points while standing
  still, pauses in the walk are literal rests. Long walks are thinned to ≤240
  notes. (An earlier prototype read the line as a continuous pitch glide — one
  oscillator with `linearRampToValueAtTime` per point — easy to rebuild if the
  contour reading is ever wanted.) Beyond that: a separate
  small tool (or a page here) fetches blocks from the channel, decodes `points_*`
  metadata, and maps geometry to music — e.g. y (north/south) → pitch and cumulative
  distance → time, or turn angle → interval and segment length → note duration.
  MIDI generation is easy in JS (SMF is simple; e.g. midi-writer-js), and Web Audio
  could play a walk right on /done. Works retroactively on every walk ever saved,
  which is the point of storing point data. Time is normalized like space (`times_*`,
  seconds from first fix), so the walker's pacing can drive rhythm/tempo, and a
  performance can stretch a walk to any duration — the score doesn't dictate the
  length of the performance.

## Development notes

- **Package manager: yarn** (yarn.lock; package-lock.json was removed — don't
  reintroduce it). Node is pinned to 22.18.0 via `.tool-versions` (asdf) because
  yarn enforces dependency engine ranges that npm ignored.

- Real GPS testing requires HTTPS on a phone — use `vercel dev`/preview deploys or
  a tunnel (localhost is exempt from the HTTPS rule but not reachable from a phone;
  use the preview URL).
- Keep the walk in `localStorage` as it records, so a crashed tab doesn't lose a walk.
