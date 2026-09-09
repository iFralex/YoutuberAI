# Server Actions and external APIs

Server operations live in `src/app/actions.js` and use the Next.js Server Actions transport. Model access is isolated in `src/lib/vertex-ai.js`, which is marked server-only.

## Contracts

Generation and revision use one serialisable discriminated contract:

~~~js
{ ok: true, data: value }
{ ok: false, error: { code: "STABLE_CODE", message: "Safe message" } }
~~~

Channel lookup predates this contract and still returns its legacy success value or `{ error }` object. Callers must keep handling both until those actions are migrated.

## Authentication boundary

`getGeneratedTranscript` and `editTranscript` call `getTokens` with the signed application cookie and Firebase configuration. They reject requests without a verified `decodedToken.user_id` using `UNAUTHENTICATED`. The UID is derived on the server and is never accepted from form input.

Channel lookup actions are still callable without this check because they support the public landing experience. Apply rate limiting before exposing the application broadly.

## `getChannelIdFromUsername(username)`

Resolves channel search to the first result:

~~~http
GET https://youtube.googleapis.com/youtube/v3/search
  ?part=id
  &maxResults=1
  &fields=items(id(channelId))
  &q=<username>
  &type=channel
  &key=<YOUTUBE_API_KEY>
~~~

Success is the first channel ID. Non-2xx responses return an error object; empty results currently fall into the generic error path. The function still contains noisy logging that should become structured and redacted.

## `getChannelData(channelId)`

Retrieves the display title and medium thumbnail from the channels endpoint. Success has this shape:

~~~js
{
  id: channelId,
  youtuber: data.title,
  image: data.thumbnails.medium
}
~~~

Empty items and absent thumbnails still lack dedicated error codes.

## Internal recent-video lookup

Generation constructs an encoded `URLSearchParams` request to the YouTube search endpoint with:

- `type=video`;
- newest-first ordering;
- the validated channel ID;
- a validated count from 5 to 50.

Missing `videoId` values are filtered. There is no pagination, timeout, retry, cache policy, or quota-specific error mapping.

## Internal caption retrieval

For each video ID, the server downloads the watch page and extracts `ytInitialPlayerResponse` using a regular expression. This is an unofficial YouTube HTML contract.

Videos shorter than 150 seconds are skipped. Caption tracks prefer English, then human-created tracks over ASR when language does not decide. The chosen track is requested as JSON3; events without segments are removed and zero-width characters are stripped.

Individual watch-page, player-response, caption-track, caption-fetch, and JSON failures are skipped so one unavailable video does not discard successful records. Generation fails with `TRANSCRIPTS_UNAVAILABLE` only when the batch yields no usable transcript.

The work remains serial. At 50 videos it may perform roughly 100 dependent HTTP requests before the model call.

## `getGeneratedTranscript(input)`

Input:

~~~js
{
  channelId: string,          // 10–100 chars
  theme: string,              // 2–50 chars
  description: string,        // 20–600 chars
  minutesNumber: number,      // integer, 2–20
  videosCount: number,        // integer, 5–50
  sources: string[]           // 1–4 values
}
~~~

Processing sequence:

1. verify the Firebase application session;
2. validate and coerce the command with Zod;
3. enforce 1 MB per source using UTF-8 server-observed bytes;
4. retrieve recent videos and all usable captions on the server;
5. combine transcript metadata and sources;
6. truncate reference context to 650,000 characters;
7. build an originality-oriented system instruction;
8. call the Vertex AI adapter;
9. validate provider JSON and return a normalised result.

Success:

~~~js
{
  ok: true,
  data: {
    model: "gemini-3.5-flash",
    script: {
      title: string,
      text: string,
      description: string,
      keywords: string[]
    }
  }
}
~~~

No raw transcript crosses back to the browser. The action currently does not persist the result, reserve a credit, enforce idempotency, or set an overall deadline.

## `editTranscript(input)`

Input contains a validated current script and a 2–250 character revision prompt. The action verifies the session, asks Vertex AI for a complete replacement object, validates it through the same output schema, and returns the same success envelope as initial generation.

Revision is stateless: the browser supplies the current script on every request. This avoids a broken provider-cache reference, but persistence and ownership must be added before revisions of stored scripts can be trusted.

## Vertex AI adapter

`src/lib/vertex-ai.js` creates its client lazily. It supports:

- Application Default Credentials with a configured project;
- explicit `VERTEX_AUTH_EMAIL` and `VERTEX_AUTH_PRIVATE_KEY` fields;
- `GOOGLE_SERVICE_KEY` containing base64-encoded service-account JSON;
- configurable location and model.

The default model is `gemini-3.5-flash`. `responseMimeType: application/json` and a JSON response schema constrain output; a second Zod check rejects missing or empty fields. The adapter uses the current `@google/genai` SDK with its stable `v1` endpoint.

Errors returned to the UI never include API keys, source content, complete transcripts, credentials, or raw provider payloads.

## Current error taxonomy

| Code | Meaning | Retry |
|---|---|---|
| `INVALID_INPUT` | server-side Zod rejection | after correction |
| `SOURCE_TOO_LARGE` | source exceeds 1 MB in UTF-8 | after correction |
| `TRANSCRIPTS_UNAVAILABLE` | no usable caption context | after channel/change |
| `GENERATION_FAILED` | configuration or model failure | after diagnosis |
| `REVISION_FAILED` | revision model failure | after diagnosis |
| `UNAUTHENTICATED` | no valid session | after login |

Channel lookup continues to return HTTP numeric codes and generic code `1`. A later cleanup should migrate it to named codes such as `CHANNEL_NOT_FOUND` and `YOUTUBE_QUOTA_EXHAUSTED`.

## Caching, quotas, and production gaps

Fetch calls do not yet set explicit cache options, abort signals, or retry policy. Generation has no rate limiter, durable job, deduplication key, credit transaction, or persistence write. Channel metadata may tolerate bounded caching; authenticated generation commands and future credit mutations must never be cached.

Never print environment values during diagnostics.
