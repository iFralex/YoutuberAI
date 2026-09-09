# Firestore data model

The repository has no Firestore Security Rules, indexes, schema validation, migrations, or seed tooling. This document distinguishes records read/written by source from a recommended model.

## Current hierarchy

~~~text
users/{uid}
  username: string
  credits: number

{uid}/{scriptId}
  youtuber: string
  imageUrl: string
  date: Firestore Timestamp
  script:
    title: string
    text: string
    description: string
    keywords: string[]
~~~

The second branch is a top-level collection whose name equals the Firebase UID. Its shape is inferred from dashboard and dialog readers; no active writer exists.

## User profile

`users/{uid}` is created in the browser at signup:

| Field | Type | Required by UI | Authority today |
|---|---|---:|---|
| `username` | string | yes | browser signup form |
| `credits` | number | yes | browser initial value of 1 |

The dashboard destructures both values. A missing document produces a navbar-only fallback; missing fields render as undefined.

Because the initial credit is written from the browser, safe rules would need to permit bootstrap without permitting later arbitrary credit changes. Prefer a trusted server transaction or Auth trigger.

## Script record

The dashboard expects:

| Field | Type | Use |
|---|---|---|
| `youtuber` | string | creator label |
| `imageUrl` | string | creator avatar |
| `date` | Firestore Timestamp | sorting and display |
| `script.title` | string | card/dialog title |
| `script.text` | string | preview and full script |
| `script.description` | string | video description |
| `script.keywords` | string[] | hashtag-like display |

Every nested value is assumed to exist. Partial records can fail during timestamp access, slicing, splitting, or keyword mapping.

### Problems with UID-named top-level collections

- Rules must match arbitrary names instead of a stable hierarchy.
- Collection-group queries cannot naturally target all scripts.
- Administrative tooling cannot infer entity type from a path.
- Account deletion requires dynamic discovery.
- Other user-owned entities have no coherent location.

## Recommended hierarchy

~~~text
users/{uid}
users/{uid}/scripts/{scriptId}
users/{uid}/generationJobs/{jobId}
users/{uid}/creditLedger/{entryId}
payments/{paymentId}
~~~

Recommended script fields:

~~~js
{
  status: "queued" | "processing" | "completed" | "failed",
  creator: {
    channelId: "UC...",
    title: "Creator name",
    imageUrl: "https://..."
  },
  request: {
    theme: "string",
    instructions: "string",
    targetMinutes: 10,
    analysedVideoCount: 15,
    sourceRefs: ["..."]
  },
  output: {
    title: "string",
    text: "string",
    description: "string",
    keywords: ["string"]
  },
  generation: {
    model: "provider/model",
    promptVersion: "v1",
    transcriptVideoIds: ["..."]
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
~~~

Do not persist full sources or transcripts by default merely because generation needs them. Define provenance, retention, and deletion first.

## Credit model

A mutable counter cannot explain changes or recover safely from concurrent requests. Use an append-only ledger with a transactionally maintained balance projection.

Required invariants:

1. only trusted server code writes ledger entries;
2. a stable idempotency key produces at most one entry;
3. balance cannot become negative;
4. generation reserves/debits before expensive work;
5. failed work creates an explicit refund/release entry;
6. payment webhooks grant exactly once;
7. displayed balance derives from authoritative ledger state.

## Ownership and rules

Every operation derives UID from a verified token or cookie. Request body, path parameter, or stored field is not proof of identity.

Recommended posture:

- deny by default;
- allow users to read only their own profile/subcollections;
- reject all client credit and payment writes;
- constrain profile updates to an allow-list;
- perform generation writes through trusted server credentials;
- validate types and immutable ownership fields;
- test rules with the Firebase Emulator Suite.

## Timestamps and evolution

Use server timestamps for creation and mutation. Browser clocks cannot govern billing, revision windows, ordering, or expiry. Readers should tolerate missing timestamps during pending server transforms.

Before production:

- add schema versions to complex records;
- validate every read;
- add pagination and query-side ordering;
- define deletion across Auth, Firestore, processors, logs, and backups;
- document transcript/source retention;
- provide migrations rather than changing shapes in place.
