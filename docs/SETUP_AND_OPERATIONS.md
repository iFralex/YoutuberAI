# Setup and operations

This runbook covers the current single Next.js application. No production infrastructure definition is present.

## Supported local baseline

Use Node.js 20 LTS and npm 10. `next-firebase-auth-edge@1.5.3` declares Node below 22 and npm below 11. The verified 2026-09-09 build used Node 24/npm 11 but emitted an engine warning, so that combination is not the recommended baseline.

## Required accounts

### Firebase

Create or select a Firebase project and:

1. enable Email/Password under Authentication;
2. create Cloud Firestore;
3. register a Web application;
4. obtain the public Web configuration;
5. create a service account for server-side token verification;
6. write and deploy Security Rules before using real accounts.

The repository supplies no Firebase CLI config or rules. Do not assume Firebase console defaults are safe.

### Google Cloud / YouTube

Enable YouTube Data API v3 and Vertex AI. Create a YouTube API key and restrict it to the API and supported deployment context. Grant the runtime service account the minimum Vertex AI permissions needed to invoke the selected model. Monitor both YouTube quota and model usage.

### Web3Forms (optional)

The contact widget cannot deliver with its placeholder key. If used, create an account/key, replace template branding, and complete privacy review. Otherwise remove/disable the widget for production.

## Environment

Copy the documented template:

~~~bash
cp .env.example .env
~~~

| Variable | Required | Notes |
|---|---:|---|
| `YOUTUBE_API_KEY` | for channel/video API calls | server only |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | public Firebase config |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | public Firebase config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | public Firebase config |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | depends on project | read by current config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | yes | public Firebase config |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | yes | service-account email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | yes | preserve escaped newline form |
| `AUTH_COOKIE_NAME` | yes | use a stable, app-specific name |
| `AUTH_COOKIE_SIGNATURE_KEY_CURRENT` | yes | high-entropy secret |
| `AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS` | yes in current array | old key during rotation; use a distinct safe value |
| `USE_SECURE_COOKIES` | yes | false on plain local HTTP, true in production |
| `VERTEX_PROJECT_NAME` | for generation | Google Cloud project ID |
| `VERTEX_LOCATION` | recommended | defaults to `global` |
| `VERTEX_MODEL` | optional | defaults to `gemini-3.5-flash` |
| `VERTEX_AUTH_EMAIL` | one auth option | explicit service-account email |
| `VERTEX_AUTH_PRIVATE_KEY` | one auth option | explicit service-account private key |
| `VERTEX_AUTH_CLIENT_ID` | optional | explicit service-account client ID |
| `GOOGLE_SERVICE_KEY` | alternative auth option | base64-encoded service-account JSON |

Both Firebase and Vertex private-key loaders replace literal `\n` sequences with line breaks. Vertex AI also supports Application Default Credentials when the project is configured, so managed runtimes do not need a long-lived key in environment variables.

## Installation

~~~bash
npm install
npm run dev
~~~

Open `http://localhost:3000`.

Expected routes:

| Route | Expected result |
|---|---|
| `/` | public landing |
| `/signup` | signup when logged out; redirect home when cookie valid |
| `/login` | login when logged out; redirect home when cookie valid |
| `/dashboard` | dashboard when authenticated; redirect to login otherwise |

## Firebase data setup

There is no seed script. A signup creates `users/{uid}` from the browser. The dashboard additionally queries a top-level collection named exactly after the UID.

For safe development, prefer an emulator configuration added to the project before manually creating records. If testing against a cloud project, use a disposable non-production project and synthetic data.

## YouTube smoke test

1. Start the app with a valid API key.
2. Create/sign into a test account.
3. Enter a full `/channel/<id>` URL first; it avoids handle search.
4. Confirm creator title/avatar appears.
5. Complete the form with at least one small text file.
6. Submit and wait for transcript retrieval and Vertex AI generation.
7. Confirm title, script, description, and keywords render.
8. Submit a revision and confirm the visible result is replaced.
9. Test Copy and download the Markdown result.

The result remains in memory and disappears when the dialog/page is closed because persistence is not implemented.

## Production build

~~~bash
npm run build
npm run start
~~~

The 2026-09-09 build produced:

| Route | Mode |
|---|---|
| `/` | dynamic |
| `/dashboard` | dynamic |
| `/login` | static |
| `/signup` | static |
| `/_not-found` | static |

Middleware was emitted separately.

### Build warnings seen in verification

- Google Fonts fetch required a retry.
- Browserslist reported stale `caniuse-lite`.

Google Fonts is fetched during build by `next/font`. Restricted builders need outbound access or a locally bundled font.

## Deployment

Any Node-capable Next.js host can be considered, but no provider is configured in source.

Minimum deployment procedure:

1. use a supported Node/npm version;
2. provision all environment values in secret storage;
3. set `USE_SECURE_COOKIES=true`;
4. confirm Firebase authorised domains include production;
5. deploy reviewed Firestore rules;
6. build without relying on developer `.env`;
7. smoke-test anonymous redirect, signup, login, logout, channel metadata, generation, and revision;
8. verify logs do not contain tokens;
9. monitor YouTube quota, Vertex AI usage, and application errors;
10. retain a rollback artifact.

Do not launch credit sales as a production capability until its trusted ledger path exists. Before public generation, add rate limiting, timeouts, persistence/ownership, processor disclosures, and automated tests.

## Cookie-key rotation

`cookieSignatureKeys` is ordered current, previous.

1. Generate a new high-entropy key.
2. Move the old current value to previous.
3. Put the new key in current.
4. Deploy and allow the maximum accepted session overlap.
5. Replace/remove the old previous key in a second deployment.

Coordinate emergency rotation with forced reauthentication. Never log keys.

## Observability

No monitoring SDK exists. A minimum future baseline should capture:

- route/action latency and error rate;
- authentication exchange failures;
- YouTube HTTP/quota error codes;
- videos requested, retained, and missing captions;
- generation job status and duration;
- Firestore permission errors;
- credit/payment reconciliation failures;
- contact-provider failures.

Use correlation IDs, redaction, sampling, and retention controls. Do not record captions or source bodies by default.

## Backup and recovery

No backup policy is encoded. Before production:

- enable/validate Firestore backup or export appropriate to the plan;
- document Auth user recovery limitations;
- test restore into an isolated project;
- define recovery objectives;
- preserve payment/credit ledgers longer than rebuildable projections;
- include external provider reconciliation.

## Capacity

Transcript retrieval is synchronous and serial in a Server Action. A 50-video request may create up to 100 sequential external fetches. Serverless time limits, YouTube throttling, user disconnects, and memory must be tested before choosing a host.

Recommended operational shift: accept a bounded job, persist status, process with explicit concurrency/rate limits, and let the UI poll or subscribe.

## Dependency maintenance

The install on 2026-09-09 reported 30 vulnerabilities. Audit with registry access:

~~~bash
npm audit
npm outdated
~~~

Review advisories and upgrade intentionally. Do not run a forced audit fix blindly because major upgrades can alter Next.js/Firebase runtime behaviour.

## Incident first steps

### Suspected secret exposure

Revoke/rotate first, then investigate history and logs. Cookie signing-key exposure requires session invalidation planning.

### Cross-user Firestore access

Disable the affected UI/mutations, deploy restrictive rules, preserve audit evidence, identify impacted paths, and follow applicable notification obligations.

### YouTube parser outage

Disable transcript generation, retain channel lookup if healthy, capture redacted fixtures, update the adapter/test fixtures, and do not loop retries against changed HTML.

### Credit inconsistency

Do not edit balances without a ledger record. The current prototype has no safe reconciliation model; keep purchase controls disabled.
