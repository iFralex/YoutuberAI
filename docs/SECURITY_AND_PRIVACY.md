# Security and privacy

This is a prototype security review derived from source. It is not a certification, penetration test, or statement of legal compliance.

## Trust model

Sensitive decisions must execute in a trusted server context:

- session verification;
- user ownership;
- credit balance and debit;
- payment fulfilment;
- generation-provider credentials;
- source/transcript retention;
- script persistence.

The browser is untrusted even after Firebase sign-in. Browser state, form validation, hidden controls, displayed credits, UID strings, and request payloads can all be modified.

## Authentication

Implemented controls:

- Firebase email/password authentication;
- Firebase ID token submitted to the authentication middleware;
- service-account verification by `next-firebase-auth-edge`;
- signed HTTP-only application cookie;
- SameSite=Lax;
- current/previous signing keys for rotation;
- middleware protection for the exact `/dashboard` route;
- logout clears browser Firebase state and requests cookie removal.

Limitations:

- password policy is only a six-character client check plus Firebase project policy;
- there is no email verification requirement, password reset UI, MFA, reauthentication, session inventory, or account deletion;
- cookie security depends on `USE_SECURE_COOKIES`; production must set it to true;
- the cookie lifetime is 12 days with no documented revocation strategy;
- token contents are logged by root and dashboard Server Components;
- only exact configured routes are protected;
- profile presence and authenticated identity can diverge.

## Authorisation and Firestore

No Firestore Security Rules are tracked, so repository-level review cannot establish data isolation.

Current risks:

- signup writes `credits: 1` from the browser;
- dashboard uses the Web SDK during server rendering without a browser Firebase Auth context;
- scripts are expected in arbitrary top-level UID-named collections;
- there is no server-owned mutation layer;
- no schema or ownership validation is visible.

Before using real data:

1. add deny-by-default rules to version control;
2. move credit and script mutations to trusted server code;
3. model scripts below `users/{uid}/scripts`;
4. derive UID from verified identity;
5. test owner, other-user, anonymous, and malformed-write cases in emulators;
6. deploy rules through a reviewed process.

## Secrets

### Server-only

- `YOUTUBE_API_KEY`;
- `FIREBASE_ADMIN_CLIENT_EMAIL`;
- `FIREBASE_ADMIN_PRIVATE_KEY`;
- both cookie signature keys.

### Intentionally public

Variables prefixed `NEXT_PUBLIC_FIREBASE_` are embedded in the client bundle. Firebase API keys identify/configure the project; they are not a substitute for Security Rules.

### Critical repository state

`.env` is currently tracked by Git even though `.gitignore` lists it. Ignore rules do not untrack an existing file. Any real secret committed at any point should be considered exposed.

Required response:

1. inventory which values were committed and where they are used;
2. rotate the YouTube key, service-account key, and cookie signing keys;
3. keep the previous cookie key only for a controlled overlap if sessions must survive rotation;
4. remove `.env` from Git tracking without deleting the developer's local copy;
5. use `.env.example` for names/placeholders;
6. inspect Git history and remote forks/caches;
7. restrict Google API keys by API and appropriate server-origin controls;
8. use deployment-platform secret storage.

Never print environment values during diagnostics.

## External data processing

### YouTube

The server sends channel IDs, handles/search terms, and video IDs to Google/YouTube. It downloads public watch pages and caption tracks. Future product/legal review should cover YouTube API Services terms, attribution, permitted storage, deletion obligations, quota, and whether style analysis is appropriate for the intended use.

### Generation provider

Google Vertex AI receives captions, user instructions, and source text through a server-only adapter. Generation and revision actions require a verified Firebase application session, validate inputs, constrain output to a JSON schema, validate the response with Zod, and return redacted failure messages. Credentials may come from Application Default Credentials, explicit environment fields, or base64-encoded service-account JSON.

Before production, document and enforce:

- provider and region;
- training/retention settings;
- data-processing terms;
- deletion capabilities;
- maximum payload and redaction;
- whether personal/confidential data is permitted;
- model/version provenance.

### Web3Forms

If configured, the browser sends contact name, email, and message directly to Web3Forms. The application needs accurate notice, lawful basis, retention, processor terms, and a working deletion path.

### Firebase

Firebase processes account identity and Firestore records. Production documentation must record project region, enabled providers, log retention, backups, authorised administrators, and deletion procedure.

## Uploaded sources

The UI reads selected text files and sends their contents to a Server Action. Treat all sources as untrusted:

- validate size using server-observed bytes;
- validate content rather than trusting MIME/extension;
- reject binary/polyglot content;
- normalise encoding;
- bound extracted text and model tokens;
- protect against prompt injection;
- scan or sandbox complex parsers if formats expand;
- avoid logging contents;
- define transient versus retained storage;
- delete abandoned uploads;
- avoid public object URLs.

Prompt injection cannot be solved by file-type validation. The generator must distinguish evidence from instructions and constrain tool access.

## YouTube parser risks

Watch HTML and captions are untrusted remote content. Bound response size and time, check status/content type, and handle redirects deliberately. The current regular expression and JSON parse operate without these safeguards.

The server constructs provider URLs from video IDs originating in API output, but future endpoint changes must prevent arbitrary URL fetches and SSRF.

## Credit and payment integrity

There is no payment system today. Do not attach a payment provider directly to current purchase buttons.

A safe implementation requires:

- server-owned prices and credit amounts;
- provider-hosted checkout or validated payment intents;
- signed webhook verification over raw request bytes;
- stable provider event IDs;
- transactional/idempotent grant;
- append-only credit ledger;
- prevention of negative balance;
- explicit refund/chargeback handling;
- currency and tax semantics;
- reconciliation tooling.

UI state is never payment proof.

## Logging and error handling

Current source logs tokens, Fetch objects, channel results, form values, selected file metadata, and errors. Production logging should:

- never include ID tokens, cookies, passwords, source contents, captions, private keys, or raw provider payloads;
- use request/job correlation IDs;
- use stable error codes;
- redact email and identifiers where not needed;
- separate user-safe messages from operator detail;
- define retention and access controls.

Remove development logs before public deployment.

## Browser and content controls

No Content Security Policy, Permissions Policy, explicit frame policy, Referrer Policy, or security-header configuration is present. Add and test them, accounting for Firebase, image hosts, and contact/generation providers.

The Next.js image allow-list permits only a narrow `yt3.ggpht.com/ytc/**` pattern. This is useful for image optimisation but not a complete remote-content policy.

## Abuse controls

There is no rate limiting for login UI, channel lookup, transcript extraction, generation, contact submission, or future credit usage. Provider quotas are not abuse controls.

Introduce:

- user/IP limits on expensive operations;
- job concurrency and per-account quotas;
- source and transcript size budgets;
- CAPTCHA or provider protection where justified;
- audit records for credit-affecting events;
- alerts for quota and error spikes.

## User-facing output safety

Marketing copy advises fact-checking, which is appropriate but insufficient. Generated scripts should be labelled as AI-assisted drafts. Users should review:

- factual claims and source attribution;
- defamation and sensitive-person claims;
- copyright and excessive imitation;
- medical, legal, financial, or safety advice;
- sponsored-content disclosures;
- community-guideline and advertising requirements.

The application must not promise originality or accuracy as a technical guarantee.

## Hardening priorities

### Release blocker

1. Rotate and untrack committed secrets.
2. Add and test Firestore rules.
3. Remove token/sensitive logging.
4. Build trusted ownership, generation, and credit boundaries.
5. Resolve vulnerable/outdated dependencies after reviewing breaking changes.
6. Add privacy/terms/contact-provider disclosures.

### Before payments or real source uploads

1. Ledger and webhook idempotency.
2. Server-side source validation and retention.
3. Rate limits and job limits.
4. Security headers and provider allow-lists.
5. Account export/deletion and processor inventory.
6. Monitoring and incident response.

## Non-goals

Firebase authentication does not by itself secure Firestore. HTTP-only cookies do not authorise arbitrary documents. Zod in a Client Component is not server validation. A successful production build is not evidence of runtime security.
