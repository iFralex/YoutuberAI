# Testing and releases

## Current quality baseline

The project has no automated test files, test framework, coverage tooling, CI workflow, ESLint configuration, formatter configuration, or dedicated typecheck script. JavaScript/JSX is used without TypeScript.

Verified on 2026-09-09:

| Check | Result |
|---|---|
| `npm install` | completed; engine warning and 30 reported vulnerabilities |
| `npm run build` | passed |
| `npm run lint` | blocked by interactive first-run ESLint wizard |
| unit tests | not configured |
| integration tests | not configured |
| browser tests | not configured |
| Firebase rule tests | rules/emulators not present |

A Next.js build compiling successfully does not exercise user interactions or detect undefined identifiers only reached at runtime.

## Build evidence

The production build generated static login/signup/not-found pages, dynamic root/dashboard pages, and middleware. Warnings included a retried Google Font request and outdated Browserslist data. Compilation and static generation completed.

## Known runtime failures a build does not catch

- live provider behaviour and credentials are not covered by the build;
- caption HTML changes can leave a channel without usable references;
- Firestore server-render permission/context mismatch;
- login error registered with an invalid form-error path;
- pricing buttons with no operation;
- placeholder contact-provider key.

## Recommended test layers

### Unit tests

Start with pure extraction:

- channel URL/handle/direct-ID parsing;
- accepted and rejected handle characters;
- caption track ordering;
- JSON3 event normalisation;
- duration filtering;
- script display formatting;
- Zod boundaries for every form.

Refactor pure helpers out of Client Components and Server Action modules so they can be tested without Next.js transport.

### Server Action contract tests

Mock Fetch and cover:

- valid channel search and metadata;
- empty results;
- 400/403/404/429/5xx;
- quota errors;
- non-video search items;
- watch page with/without player response;
- no captions;
- automatic versus human captions;
- malformed JSON and network timeout;
- partial multi-video failure;
- stable serialisable errors.

Use stored synthetic HTML/JSON fixtures. Do not make routine CI depend on live YouTube.

### Component tests

With Testing Library:

- logged-in/out navbar variants;
- form validation and root errors;
- auth pending state;
- generation-dialog fields;
- file acceptance/rejection/removal;
- script preview truncation;
- detail rendering with missing optional data;
- pricing disabled/available states;
- contact success/failure.

### Firebase integration tests

Use the Emulator Suite for:

- signup profile bootstrap;
- anonymous denial;
- owner reads;
- cross-user denial;
- client credit-write denial;
- trusted script writes;
- malformed-schema denial;
- account deletion.

Rules tests are release blockers once real user data is in scope.

### End-to-end tests

Use Playwright against emulated Firebase and stubbed YouTube/model providers:

1. anonymous landing → auth prompt;
2. signup → initial profile → dashboard;
3. login/logout redirects;
4. channel URL → resolved creator;
5. form → queued/completed script using a stub;
6. insufficient credit;
7. provider/caption failure and retry;
8. history detail → copy/download;
9. keyboard/mobile/theme basics.

### Security tests

- secrets absent from client bundles and Git-tracked env files;
- middleware covers every private route;
- Firestore cross-user access is denied;
- server ignores client-provided ownership and prices;
- source size/type/content is validated;
- credit race tests cannot create negative balance;
- webhook replay grants once;
- logs redact credentials/content.

## Proposed scripts

After tools are selected, converge on non-interactive commands such as:

~~~json
{
  "scripts": {
    "lint": "next lint",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "check": "npm run lint && npm run test && npm run build"
  }
}
~~~

For a newer Next.js migration, use the supported ESLint CLI rather than retaining a removed command. Pin the Node version in `.nvmrc` or `package.json#engines`.

## Coverage priorities

High-risk code requires branch coverage, not only line coverage:

| Priority | Area | Reason |
|---:|---|---|
| P0 | ownership and Firestore rules | cross-user exposure |
| P0 | credit/payment transitions | direct financial impact |
| P0 | source ingestion | untrusted content |
| P1 | auth cookie lifecycle | access and account recovery |
| P1 | YouTube adapter failures | external fragility |
| P1 | generation idempotency | duplicate cost/output |
| P2 | marketing/UI rendering | lower operational impact |

## Release gates

### Prototype demo

- supported Node version;
- clean install;
- production build;
- test Firebase project only;
- synthetic data;
- no payment controls presented as functional;
- generation credentials configured only in the isolated demo environment;
- no real secrets in Git.

### Private alpha

- tested generation contract;
- trusted persistence and ownership;
- Firestore rules and emulator tests;
- coherent file limits;
- rate/time/size bounds;
- error monitoring;
- privacy and terms;
- account deletion;
- unit/integration/E2E CI;
- dependency audit reviewed.

### Payments/public release

- server-owned price catalogue;
- signed webhook verification;
- idempotent payment and credit ledger;
- refund/chargeback reconciliation;
- provider and privacy disclosures;
- abuse controls;
- backup/restore exercise;
- incident runbooks;
- accessibility and browser checks;
- validated marketing claims.

## Release procedure

1. Freeze the candidate commit and record dependency lock hash.
2. Confirm no unrelated or secret files are staged.
3. Install with the chosen reproducible command.
4. Run lint, unit/integration tests, and production build.
5. Run Firebase rules tests.
6. Run stubbed end-to-end tests.
7. Review dependency advisories and accepted risk.
8. Deploy to an isolated preview environment.
9. Smoke-test login, logout, channel lookup, generation, persistence, and history.
10. Verify logs and external provider dashboards.
11. Deploy production with a rollback artifact.
12. Monitor error/quota/job/payment signals.

## Documentation release evidence

When behaviour changes, update:

- README status and limitations;
- workflow status;
- action contracts;
- environment template;
- Firestore model/rules;
- operational smoke tests;
- verified baseline date.

Do not update documentation to describe an intended state before its code and tests exist.
