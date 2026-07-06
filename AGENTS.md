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
- **No absolute location is ever stored.** GPS is used live to draw the line, but
  before saving, points are converted to (x, y) offsets in meters from the walk's
  start, north-up. Every walk lives in the same abstract space starting at (0,0) —
  shape, scale, distance, and duration survive; where on Earth it happened does not.
  Raw lat/lng never leaves the device.

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
```

**Point encoding**: the Google polyline algorithm (delta + varint + base64-ish), but
applied to (x, y) meter offsets from the walk's start at 0.1m precision instead of
lat/lng at precision 5. North-up, x = east, y = north, first point always (0,0).
We own both encoder and decoder, so this is just a spec detail — document it in code.
~5–10 bytes/point; a multi-hour walk fits within 32KB. Downsample (min-distance
threshold or Douglas-Peucker) before encoding if needed. Per-point timestamps are NOT
stored in v1 — only start time + duration. Revisit if reperformance needs pacing data.

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

1. **Scaffold**: `create-next-app` (TypeScript, App Router, no Tailwind unless we want it).
2. **OAuth**: register app on are.na, env vars (`ARENA_CLIENT_ID`, `ARENA_CLIENT_SECRET`),
   auth routes, cookie session, `/v3/me` to show who's signed in.
3. **Recorder**: geolocation + wake lock + live canvas preview. Testable on desktop with
   a fake-GPS dev mode (simulated point stream) since desktops don't move.
4. **Renderer**: points → normalized path → offscreen canvas → PNG blob. Pure function,
   unit-testable with recorded fixtures.
5. **Upload**: presign → S3 PUT → create block with metadata → success screen linking
   to the block.
6. **Polish**: error states (GPS denied, walk too short, upload failure with retry —
   keep points in localStorage until confirmed uploaded), visual design.
7. **Deploy**: Vercel, custom domain, register production redirect URI.

## Development notes

- Real GPS testing requires HTTPS on a phone — use `vercel dev`/preview deploys or
  a tunnel (localhost is exempt from the HTTPS rule but not reachable from a phone;
  use the preview URL).
- Keep the walk in `localStorage` as it records, so a crashed tab doesn't lose a walk.
