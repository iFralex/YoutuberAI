# Architecture

This document describes the runtime represented by the current YoutuberAI source tree. It separates implemented behaviour from intended product behaviour so future work has an accurate baseline.

## System boundaries

| Boundary | Owns today | Must not be trusted to own |
|---|---|---|
| Browser | rendering, form state, Firebase sign-in, signup profile write, file selection, contact submission | service credentials, YouTube API key, credit authority, ownership decisions |
| Next.js Server Components | cookie inspection, initial landing/dashboard rendering, dashboard data load | long-running model work, browser Firebase session state |
| Server Actions | YouTube API calls, watch-page download, caption parsing | payment authority or client-selected user identity |
| Edge middleware | application-cookie issuance/removal and dashboard access gate | Firestore document authorisation by itself |
| Firebase Auth | email/password identity and ID tokens | application entitlements and credit correctness |
| Firestore | user profile and expected script records | business invariants without Security Rules and trusted mutations |
| YouTube | channel metadata, search results, watch HTML, captions | stable internal HTML or guaranteed caption availability |
| Web3Forms | contact form delivery | application authentication or storage policy |

## Application composition

The project uses the Next.js App Router. The root layout applies Inter, the theme provider, a global footer, and the floating contact widget to every route. Individual pages add their own navbar.

| Route | Rendering | Access | Primary responsibility |
|---|---|---|---|
| `/` | dynamic Server Component plus client descendants | public | inspect cookie and render landing with logged-in/out state |
| `/login` | static client page | public; valid sessions redirect home | Firebase login and application-cookie creation |
| `/signup` | static client page | public; valid sessions redirect home | Firebase account creation, login, and profile creation |
| `/dashboard` | dynamic Server Component | middleware-protected | load profile/scripts and render account workspace |
| `/api/login` | middleware-owned virtual endpoint | public path in auth middleware | verify bearer ID token and issue signed cookie |
| `/api/logout` | middleware-owned virtual endpoint | matched by auth middleware | clear signed cookie |

The middleware matcher is exact: `/dashboard`, `/api/login`, and `/api/logout`. If nested authenticated routes are introduced, the matcher must be expanded deliberately.

## Component model

### Server Components

- `src/app/page.js` reads the application cookie and passes login state into the landing page.
- `src/app/dashboard/page.jsx` reads the cookie and passes the decoded Firebase user ID to `Dashboard`.
- `src/app/dashboard/dashboard.jsx` loads Firestore through the Firebase Web SDK, formats timestamps, and renders account data.

### Client Components

Authentication pages, navigation, forms, dialogs, dark mode, disclosures, the dropzone, pricing controls, and the contact widget run in the browser. The `use client` boundary propagates through their imports.

### Shared UI

`src/components/ui` contains JavaScript adaptations of shadcn-style components on Radix primitives. `components.json` records aliases and Tailwind integration. These components are local source, not a runtime shadcn dependency.

## Authentication architecture

~~~text
Email/password submit
        │
        ▼
Firebase browser SDK
        │ credential + ID token
        ▼
GET /api/login with Authorization: Bearer <id-token>
        │
        ▼
next-firebase-auth-edge middleware
        │ verifies token with Firebase service account
        ▼
Signed HTTP-only application cookie
        │
        ├── root route reads optional identity
        └── /dashboard requires valid identity
~~~

The browser Firebase session and application cookie are related but independent. Logging into Firebase alone is insufficient for the protected Next.js route; `/api/login` must succeed. Conversely, an application cookie can remain valid independently of browser-side in-memory state until expiry or logout.

Cookie properties come from `auth-config.js`:

- path `/`;
- HTTP-only;
- SameSite=Lax;
- Secure only when `USE_SECURE_COOKIES` equals the string `true`;
- maximum age of 12 days;
- current and previous signature keys for rotation overlap.

Valid tokens presented on login/signup routes cause a redirect to `/`. Invalid credentials on protected paths redirect to `/login`.

## Channel-analysis flow

~~~text
MainForm
  │ normalise URL locally
  ├── @handle ───────────────► getChannelIdFromUsername
  ├── /channel/<id> ─────────► use extracted ID
  └── direct identifier ─────► use input as ID
                                  │
                                  ▼
                           getChannelData
                                  │
                                  ▼
                      creator name + avatar + ID
                                  │
                                  ▼
                         CreateDialog opens
                                  │
                                  ▼
                 getGeneratedTranscript(command)
                         │                   │
                         ▼                   ▼
                YouTube search API     watch HTML/captions
                         └─────────┬─────────┘
                                   ▼
                          transcript records
                                   │
                                   ▼
                         Vertex AI adapter
                                   │
                                   ▼
                    structured in-memory script
~~~

The official API is used for channel search, metadata, and recent video IDs. Captions are obtained by extracting `ytInitialPlayerResponse` from watch-page HTML and fetching the chosen track's base URL as JSON3.

## Rendering and data consistency

There is no application service or repository layer. UI modules call Firebase or Server Actions directly:

- signup writes the profile from the authenticated browser;
- dashboard reads Firestore during server rendering;
- channel actions return directly to client components;
- authenticated generation/revision actions orchestrate YouTube and Vertex AI;
- no current code persists generation results.

This creates two important consistency gaps:

1. account creation and profile creation are separate operations; Firebase Auth can succeed while the Firestore write fails;
2. generation is operational, but credit debit and script persistence have no atomic boundary because they are not implemented.

The dashboard expects every script document to contain a Firestore timestamp at `date`. A missing value fails before rendering because the code reads `date.seconds`.

## External dependencies

### Firebase

The same configuration module contains public client settings and server-only service-account settings. Client modules import only `clientConfig`, but bundle separation should remain explicit.

The Firebase Web SDK is used for browser operations and a server-rendered dashboard read. No Firebase Admin Firestore client exists. The server-side Web SDK does not inherit the browser Firebase Auth user merely because the Next.js request has an application cookie.

### YouTube

The API key stays inside a server module. Requests have no explicit cache policy, timeouts, abort signals, retries, or structured rate-limit handling.

Watch-page caption discovery is unofficial and fragile. It should be isolated behind an adapter with fixtures because YouTube can change HTML, consent behaviour, or caption payloads without an API-version transition.

### Vertex AI

The server-only Google Gen AI adapter creates its client lazily, supports Application Default Credentials or environment-provided service-account credentials, constrains output with a provider JSON schema, and validates it again with Zod. The default model is configurable through `VERTEX_MODEL`.

Prompts and complete reference context are processed by Google Vertex AI. There is no timeout, retry, rate limit, durable job, persistence, or model-call telemetry yet.

### Web3Forms

The contact widget posts directly from the browser to Web3Forms. The access key is a placeholder. Name, email, and message would be sent to this provider if configured.

## Failure semantics

- Legacy channel actions and generation actions still use different result conventions.
- Caption retrieval skips individual videos that cannot be parsed, so a changing YouTube page may reduce the usable sample silently.
- Videos below 150 seconds are silently skipped.
- Videos without captions are skipped.
- Search items without `videoId` are filtered.
- A missing channel search result causes unchecked array access.
- Form code can assume `res.error` exists when local parsing returned null.
- There is no timeout or cancellation path for multi-video work.
- Generation fails safely when the Firebase session, transcripts, or Vertex configuration are unavailable.

## Performance characteristics

Transcript work is serial. At the UI maximum of 50 videos it can require up to 100 sequential HTTP requests—one watch page and one caption request per retained video—plus the Data API request.

The workflow limits the combined model context but has no cache, deduplication, progress reporting, overall deadline, per-request timeout, or background queue. Moving it behind a durable job is advisable before meaningful traffic.

## Recommended target boundary

~~~text
Browser
  └── validated generation command
          │ signed user session
          ▼
Next.js trusted orchestration layer
  ├── ownership and credit transaction
  ├── YouTube adapter
  ├── source ingestion and text extraction
  ├── model adapter
  └── script repository
          │
          ▼
users/{uid}/generationJobs/{jobId}
users/{uid}/scripts/{scriptId}
~~~

The trusted layer should derive the UID from the verified session, reserve credit before expensive work, record a generation job, and finalise the script and debit atomically or with an idempotent compensation strategy.

## Extension rules

1. Keep provider access in server-only modules.
2. Define one serialisable result contract for every action.
3. Validate at trusted boundaries even when the browser already uses Zod.
4. Never use a UID supplied by the browser as proof of ownership.
5. Place user-owned records below `users/{uid}`.
6. Make payment and credit operations transactional and idempotent.
7. Isolate unofficial YouTube parsing behind tests and fixtures.
8. Avoid importing browser Firebase composition into Server Components.
9. Add middleware coverage for every authenticated route subtree.
10. Document whether a feature is implemented, gated, mocked, or planned.

## Scope

There is no deploy manifest, Firebase ruleset, CI configuration, worker, payment system, analytics platform, or production topology to document as implemented.
