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
   walks and show the gallery. Create or choose a channel where signed-in users
   can post. Do not commit credentials or share the client secret in chat.
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
