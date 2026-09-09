# Troubleshooting

Start with the narrowest symptom. Do not paste tokens, cookies, private keys, full `.env` files, captions, or uploaded source contents into logs or issues.

## `next: command not found`

Dependencies are absent.

~~~bash
npm install
npm run dev
~~~

Use Node 20/npm 10 to match the declared engine range of the authentication dependency.

## Install shows an engine warning

`next-firebase-auth-edge@1.5.3` requires Node below 22 and npm below 11. Switch to Node 20 LTS. The application may build on newer versions, but that is outside the dependency's declared support.

## Build cannot fetch Inter

`next/font/google` fetches Inter during build. Confirm builder network/DNS access. For hermetic builds, vendor the font with `next/font/local`.

## Build reports `ENOSPC`

The environment lacks disk space or inodes, often while Webpack writes `.next/cache`. Inspect available space, remove safe disposable build caches, and rerun. Do not delete broad directories or user data.

The verified build completed despite cache-write failure, but this can slow builds and may eventually fail.

## `npm run lint` opens a prompt

There is no ESLint configuration. Run the setup interactively once, review generated configuration, commit it, and make sure the command then runs non-interactively in CI. Do not treat cancellation as a passing lint check.

## Dashboard redirects to login

Check:

1. browser Firebase sign-in succeeded;
2. `/api/login` was requested with a bearer ID token;
3. response created the configured cookie;
4. cookie name and signature keys match across instances;
5. Secure is false only for local HTTP and true for HTTPS production;
6. Firebase service-account values belong to the same project as public config;
7. system time is correct;
8. middleware logs show token reason without exposing the token.

## Login succeeds in Firebase but dashboard still redirects

The browser Firebase session exists, but the application cookie was not created. Inspect `/api/login` status and middleware configuration. These are separate session layers.

## Logged-in user can still see login/signup

The root page decides state from the application cookie, not the browser Firebase SDK. Refresh after cookie creation. If it persists, verify cookie path/name/domain and server-side environment.

## Signup created an account but dashboard is empty

Firebase Auth may have succeeded while the browser Firestore write failed. Inspect `users/{uid}` in the correct project and check rules/errors.

Current fallback renders only the logged-in navbar when the profile is absent. Recovery should create the missing profile through trusted server code, not manually grant arbitrary credits in a public client.

## Firestore permission denied on dashboard

The dashboard queries Firestore with the Web SDK while rendering on the server. A signed Next.js cookie does not authenticate that SDK as the browser Firebase user. With owner-only rules, the query can fail.

Preferred fix: use a trusted server repository/Admin SDK after verifying the cookie, or move the read into an authenticated browser data path with correct rules. Do not weaken rules globally.

## Channel URL is rejected or returns null

Accepted forms are narrowly defined:

- `youtube.com/@handle` using letters, digits, underscore;
- `youtube.com/channel/<id>`;
- direct identifier.

Try a canonical `/channel/<id>` URL. Other YouTube URL families are not supported. Expand parser tests before expanding regexes.

## Channel not found

Check API key, YouTube Data API enablement, key restrictions, quota, and exact channel ID. The handle flow uses text search and takes the first result, which may be absent or not the intended channel.

## YouTube API returns 403

Common causes:

- API not enabled;
- invalid/restricted key;
- quota exhausted;
- project/billing/policy restriction.

Inspect the provider error privately and map it to a stable user-facing code. Never send the key to the browser.

## Creator appears, but transcript retrieval fails

Possible causes:

- recent search includes non-video items;
- selected videos have no captions;
- watch page is blocked, restricted, or requires consent;
- YouTube changed player HTML;
- the regular expression no longer matches;
- caption JSON changed;
- a request timed out or failed;
- every video was below 150 seconds.

Test with a known public captioned long-form video and a saved synthetic fixture. Avoid repeated high-volume retries.

## Some recent videos are missing

Videos shorter than 150 seconds are silently skipped. Videos with parsing/caption problems can abort the whole current loop rather than produce partial status. Search returns one page only.

## Submit spins and then crashes with generation error

Read the stable UI error code first:

- `UNAUTHENTICATED`: sign in again and verify cookie configuration;
- `TRANSCRIPTS_UNAVAILABLE`: use a channel with accessible long-form captions;
- `INVALID_INPUT` or `SOURCE_TOO_LARGE`: correct the form/source constraints;
- `GENERATION_FAILED`: verify the Vertex project, location, model, credentials, IAM permissions, API enablement, and quota.

Provider details are logged server-side using only the error name/message; do not expose credentials or source content while debugging.

## File is rejected unexpectedly

The active policy is four text, Markdown, or CSV files, 1 MB each. Browsers can report unexpected MIME types; rename/export the source as `.txt`, `.md`, or `.csv` and verify its size.

## Script cards crash the dashboard

Validate each record has:

- Firestore Timestamp `date`;
- string `script.title`;
- string `script.text`;
- string `script.description`;
- array `script.keywords`;
- string `youtuber` and `imageUrl`.

The reader has no runtime validation or defaults. Also ensure records are stored in the top-level collection named exactly after the UID.

## Copy fails while Download works

Clipboard APIs require a secure context in many browsers. Test on HTTPS or localhost and verify browser clipboard permission. Download does not use the Clipboard API and should still create a Markdown file locally.

## Purchase button does nothing

It has no click handler. No checkout/payment integration exists. Keep it disabled or label it unavailable until server-owned pricing, webhooks, and ledger are implemented.

## Contact form fails

The access key is the placeholder `YOUR_ACCESS_KEY_HERE`. Configure Web3Forms only after privacy review and update template branding. Network/CSP blockers can also prevent the direct browser request.

## Remote creator image does not render

`next.config.mjs` allows HTTPS images only from `yt3.ggpht.com` paths beginning `/ytc/**`. YouTube may return another host/path. Inspect the actual URL and expand the smallest safe pattern if necessary.

## Dark mode flashes or mismatches

Theme is resolved client-side and hydration warning is suppressed. Confirm the ThemeProvider wraps the route, HTML keeps suppression, and Tailwind scans the relevant files. A short first-render difference may remain without an inline theme bootstrap.

## npm reports dependency vulnerabilities

Run `npm audit` with registry access, inspect direct and transitive advisories, and test targeted upgrades. Do not use `--force` without reviewing framework/auth breaking changes. The 2026-09-09 install reported 30 findings.

## Wrong Firebase project

Public config and service-account config must reference the same intended environment. Symptoms include login succeeding but cookie verification failing, empty Firestore data, or permission errors. Compare project IDs—not secret values—in a private diagnostic context.

## Minimal diagnostic bundle

Safe information for an issue:

- commit hash;
- Node/npm versions;
- command and exit status;
- route/action name;
- stable error code and HTTP status;
- whether Firebase emulator or cloud test project is used;
- redacted channel ID if necessary;
- minimal synthetic reproduction.

Never attach `.env`, service-account JSON, ID tokens, cookies, passwords, private user sources, or full transcripts.
