# Walk as Score

A Next.js app that lets people sign in with Are.na, record a walk and publish its
rendered score to a shared Are.na channel. See [AGENTS.md](AGENTS.md) for the
architecture and privacy details.

## Connect Are.na on Vercel

The production deployment at `https://walking-score-a.vercel.app` is already
linked to this GitHub repository. OAuth needs an Are.na application and server
configuration; a GitHub link alone does not provide OAuth credentials.

1. Sign in to Are.na and create an [OAuth application](https://www.are.na/developers/oauth/applications).
   Set its redirect/callback URI to exactly:

   ```text
   https://walking-score-a.vercel.app/api/auth/callback
   ```

2. In Vercel, open project **walking-score-a → Settings → Environment Variables**.
   Add these variables for **Production**:

   | Name | Value |
   | --- | --- |
   | `ARENA_CLIENT_ID` | Client ID of the Are.na OAuth application |
   | `ARENA_CLIENT_SECRET` | Its client secret (keep secret; use a sensitive/encrypted variable) |
   | `ARENA_WALKS_CHANNEL` | ID or slug of the public, open channel to which walks should be posted |

   The first two are required for sign-in. The channel is also required to save
   walks and show the gallery. Use only the channel slug or numeric ID, not its
   full URL. Create or choose a channel where signed-in users can post. Do not
   commit credentials or share the client secret in chat.
3. **Redeploy the production deployment** after saving the variables: changes to
   Vercel environment variables do not update an existing deployment. Then visit
   `https://walking-score-a.vercel.app/api/auth/login`, authorize the app, and
   test publishing a walk from a phone. The app requests Are.na's `write` scope
   so the signed-in walker can create a block.

The callback URI is derived from the host where sign-in starts and must match
one registered with Are.na. Preview deployments and local development need a
matching registered HTTPS callback (and their own Vercel Preview or local
variables); do not start a preview login using the production callback, because
the OAuth state cookie is host-specific.

The implementation uses Are.na's [v3 OAuth endpoints](https://www.are.na/developers/explore)
with a server-side client secret and a state cookie. The referenced
[arena-rb](https://github.com/khanhlegood11/arena-rb) is a Ruby API client
using v2 by default; this Next.js app calls v3 directly rather than installing it.

## Local development

Use Node 22 and Yarn. Copy `.env.example` to `.env.local`, fill in your own
credentials and channel, and register the HTTPS local callback with Are.na:
`https://localhost:3000/api/auth/callback` (or another HTTPS host you use).
Keep `.env.local` private.

```bash
yarn install --frozen-lockfile
yarn dev
```

Open `https://localhost:3000`. The dev script uses Next.js experimental HTTPS;
you may need to trust its local certificate. Geolocation testing on a phone
requires an HTTPS host reachable from the phone. Run `yarn lint` and `yarn build`
to check changes.

## Gallery and channel visibility

The gallery shows walks created by this app, not every image or block in the
channel. It redraws their saved point metadata. The first 100 channel items are
read on each page request. Public channels can be read without signing in; for
private channels the server uses the current viewer's Are.na token, so only
users with access can see those walks. Opening a private channel to everyone
can expose its existing contents; use a separate open channel for a public
community gallery. Changes to channel visibility and permissions are managed
on Are.na, not by this app.

## Save a walk to Mindstamps

Each gallery score has a **Lưu sang Memory** button. The visitor signs in
separately with their Mindstamps Firebase account, chooses a point on a Mapbox
map and names it, and explicitly confirms what will be shared. The app creates a
Mindstamps-compatible Firestore memory with the complete walk title, a PNG of
its score, date, distance, duration and Are.na block link. It does not transfer
raw GPS or infer the walk's location. Are.na links may point to private blocks
that other people cannot open.

The public Firebase web configuration defaults to the values in the
[Mindstamps source](https://github.com/khanhle5/Mindstamps/blob/main/src/config/firebase.js).
Before enabling this in production, verify that `zofovn.vercel.app` uses that
same Firebase project; if it overrides those defaults, set all four
`NEXT_PUBLIC_MINDSTAMPS_*` variables from `.env.example` to the deployed app's
**web** configuration and rebuild. These values are public; never use an admin
or service-account key. Enable the desired Firebase Authentication providers and
add the Walking Score hostname to the Firebase Authentication authorized domains
for Google login. Firebase sessions are separate between the two websites.

The Mindstamps repository's Firestore rules allow public reads of memories. The
confirmation dialog warns that the title, score image, details, link and manually
selected location may be public. Verify the deployed rules independently; this
integration does not change Mindstamps or its access policies. To test, use a
Mindstamps test account and explicitly save a test walk, then check its Journal.

### Mapbox location picker

Set `NEXT_PUBLIC_MAPBOX_TOKEN` to a **public** Mapbox browser token (`pk.*`)
in `.env.local` or the appropriate Vercel environments. You can use the public
`VITE_MAPBOX_TOKEN` from the Mindstamps deployment, provided its URL restrictions
also allow the Walking Score host. Optionally set `NEXT_PUBLIC_MAPBOX_STYLE` to a
style accessible to that token; the default is Mapbox Streets v12. Public Next.js
environment variables are embedded during build: redeploy after changing them.
Without a token the picker explains the missing configuration and saving is
disabled. Never put a secret (`sk.*`) token in a `NEXT_PUBLIC_` variable.

The map starts at a generic world view, never uses GPS or infers the walk's
location. A visitor can click the map (or move it with the keyboard and choose
its center) and type a name without searching. Map tiles and optional search
queries are sent to Mapbox. Search uses the Mapbox Geocoding v6 API with
`permanent=true` because a selected result can be stored in Firestore. Mapbox
requires an eligible account (such as a valid credit card or enterprise
agreement) for permanent geocoding; usage may incur charges. See the
[Mapbox geocoding documentation](https://docs.mapbox.com/api/search/geocoding/)
and pricing before enabling it. If search is unavailable, users can still pick
a point on a working map and enter the name themselves. The selected location
is deliberately saved to Mindstamps only after the visitor confirms, and may be
public; the Are.na walk remains location-normalized.
