# Product and runtime workflows

This guide follows each user-visible journey and records its implementation state.

## Status vocabulary

| Label | Meaning |
|---|---|
| Implemented | Source contains the complete local flow, subject to external configuration |
| Partial | A meaningful portion exists, but the journey cannot complete reliably |
| Presentation only | UI or copy exists without its business operation |
| Planned/inferred | Source shape implies an intention but contains no implementation |

## Landing and session-aware navigation

**Status: implemented.**

1. A request reaches `/`.
2. The Server Component reads tokens from the request cookies.
3. A valid signed cookie contributes the decoded email to `HomePage`.
4. The navbar renders a dashboard link for a logged-in visitor, or signup/login links otherwise.
5. The hero renders `MainForm` with the same login state.
6. Footer and contact widget render globally from the root layout.

The route stays public regardless of cookie state. Token details are currently printed during rendering and should be removed.

## Anonymous channel submission

**Status: implemented as an authentication prompt.**

An anonymous user may type in the channel field, but “Vai” is a button that opens a dialog rather than submitting. The dialog links to login and signup. The CTA opens its destination in a new tab because the shared component always uses `target=_blank`.

## Signup

**Status: partial.**

1. Browser validation requires a three-character username, valid email, six-character password, and matching confirmation.
2. Firebase Auth creates the identity.
3. `LoginAccount` signs in and obtains an ID token.
4. The browser calls `/api/login` with that token.
5. Middleware creates the signed application cookie.
6. The browser writes `users/{uid}` with one credit and the username.
7. The router moves to `/dashboard`.

Identity creation, cookie creation, and profile creation are not atomic. If the Firestore write fails, the user exists but has no profile. The dashboard then renders only the logged-in navbar.

## Login

**Status: implemented, with an error-display caveat.**

Firebase verifies email/password, its ID token is sent to `/api/login`, middleware sets the cookie, and the router navigates to the dashboard.

The catch handler calls `form.setError(e.message)` rather than assigning a field or root error in the shape used elsewhere. Firebase failures may not render consistently.

## Logout

**Status: implemented.**

The navbar signs out the Firebase browser client, calls `/api/logout`, and returns to `/`. If the second request fails, the application cookie may remain valid until expiry.

## Channel input normalisation

**Status: partial.**

`getChannelId` removes the query string and checks:

1. `youtube.com/@handle` → resolve through API search;
2. `youtube.com/channel/<id>` → use the captured ID;
3. a direct letters/digits/underscore/hyphen string → use it as an ID;
4. anything else → return null.

Limitations:

- hyphens are not accepted inside handles;
- `youtu.be`, `/c/`, `/user/`, mobile hosts, and percent encoding are not intentionally handled;
- any simple string matching the direct regex is treated as a channel ID;
- null is not converted into a dedicated validation message before metadata lookup.

## Channel resolution

**Status: implemented for the happy path.**

Handle lookup uses YouTube search with `type=channel` and `maxResults=1`. Metadata lookup requests only title and medium thumbnail. Success populates:

~~~js
{
  id: channelId,
  youtuber: channelTitle,
  image: { url: "https://...", width: Number, height: Number }
}
~~~

Mounting `CreateDialog` opens it by default.

## Generation form

**Status: implemented for text sources.**

The user supplies a theme, detailed instructions, target duration, number of videos, and text sources. Zod validation runs in the browser for feedback and again inside the authenticated Server Action.

| Input | Validation/UI |
|---|---|
| Theme | 2–50 characters |
| Description | 20–600 characters |
| Duration | 2–20 minutes, visual default 10 |
| Videos | 5–50, visual default 15 |
| Sources | Zod allows 1–4 |

The dropzone and both validation layers consistently allow up to four text, Markdown, or CSV files of 1 MB each. Files are read in the browser as text; the server validates the resulting UTF-8 byte size before using them.

## Transcript acquisition

**Status: implemented, with an unofficial upstream dependency.**

1. Recent search results are requested.
2. Each video ID is processed serially.
3. The public watch page is downloaded.
4. A regular expression extracts the initial player response.
5. Videos below 150 seconds are skipped.
6. Title, short description, and keywords are retained.
7. Caption tracks are sorted by language/type preference.
8. The chosen track is fetched as JSON3.
9. Events without segments are removed.
10. Segment text is joined and zero-width characters are stripped.

The duration filter is a code-only rule and is not explained in the UI.

## Script generation

**Status: implemented, not yet persisted.**

The browser sends the channel ID, complete brief, selected analysis depth, and extracted text sources to `getGeneratedTranscript`. The action verifies the signed Firebase session, validates all fields, retrieves transcripts on the server, limits the combined context, and calls the server-only Vertex AI adapter.

The default model is configurable and returns schema-constrained JSON. Zod then validates the provider response and normalises it as `{ model, script: { title, text, description, keywords } }`. The prompt treats references as grounding and high-level style evidence, explicitly prohibiting copied phrases. Persistence, timeouts, retries, idempotency, and credit operations remain absent.

## Script review, copy, and download

**Status: implemented for the current session.**

The expected script has title, text, description, and keywords. Cards truncate text to 350 characters; the detail dialog renders paragraphs from blank lines or the legacy `——` delimiter.

Copy writes the current structured result as Markdown to the clipboard. Download creates a local Markdown file with a title-derived safe filename. When `mutable` is enabled, a 2–250 character revision request sends the complete current script to the authenticated revision action and replaces the visible result.

## Script history

**Status: read path only.**

The dashboard reads every document from a collection named after the UID, sorts in memory by timestamp, formats dates for Italy, and renders cards.

There is no pagination, query-side ordering, generation write path, deletion, or rename. Revision works for a newly generated in-memory result, but the revised value is not persisted.

## Credits and pricing

**Status: presentation only, except signup grant.**

Signup writes `credits: 1`. Four hard-coded offers appear on landing and dashboard:

| Price | Credits |
|---:|---:|
| €14.99 | 1 |
| €34.99 | 3 |
| €59.99 | 5 |
| €99.99 | 10 |

Buttons have no handler. There is no payment provider, trusted price catalogue, ledger, webhook, invoice, debit, or idempotency. FAQ promises around credit-bound generation and five revisions in 15 minutes are not enforced.

## Contact widget

**Status: template UI; delivery not configured.**

The global widget collects name, email, and message and posts them directly to Web3Forms. Hidden fields contain a placeholder key, a name-derived subject, `Nextly Template` branding, and a bot check.

Before enabling it, configure a provider key, update branding, publish privacy information, and decide retention/processor terms.

## Theme

**Status: implemented.**

`next-themes` applies mode as a class. Tailwind uses class-based dark mode and CSS-variable colour tokens. Hydration warnings are suppressed because theme resolution can differ between server and browser.

## Marketing content

**Status: static content.**

Benefits, creator categories, testimonials, prices, FAQ, navigation, and footer claims live in source. They are not CMS-backed.

Claims such as “2000+ scripts,” “500+ creators,” originality, revision entitlement, and price contracts are copy rather than enforced system behaviour. Validate them before launch.
