# Contributing to Youtuber AI

This repository is a prototype with known incomplete flows. Changes should improve the accuracy of the implementation and documentation together, without hiding unfinished behaviour behind optimistic copy.

## Before changing code

Read:

1. [README](README.md) for product status;
2. [Architecture](docs/ARCHITECTURE.md) for trust boundaries;
3. [Workflows](docs/WORKFLOWS.md) for current journey state;
4. [Security and privacy](docs/SECURITY_AND_PRIVACY.md) when touching identity, Firestore, sources, credits, payments, or external providers;
5. [Server Actions](docs/SERVER_ACTIONS.md) when changing YouTube integration.

## Local setup

Use Node 20 LTS/npm 10, install dependencies, copy the environment template, and use a disposable Firebase project:

~~~bash
npm install
cp .env.example .env
npm run dev
~~~

Never commit environment values, service-account files, user sources, captions, generated private data, or tokens.

## Working tree discipline

- Preserve unrelated local changes.
- Keep one concern per commit where practical.
- Do not reformat the entire repository during a functional fix.
- Update `package-lock.json` whenever dependency changes require it.
- Do not commit `.next`, `node_modules`, local logs, Firebase exports, or credentials.
- Review staged changes before commit, especially configuration and generated files.

The repository currently tracks `.env`. Removing it safely requires an explicit security cleanup and secret rotation; merely listing it in `.gitignore` is insufficient.

## Code boundaries

### Browser code

Client Components may own interaction and local form state. They must not own:

- credit or price authority;
- ownership decisions;
- service-account/model/payment secrets;
- trusted source validation;
- final persistence invariants.

### Server code

Trusted code must:

- derive identity from a verified session;
- validate every external input;
- return serialisable results;
- bound network work by time and size;
- redact logs;
- make financial/provider retries idempotent.

### Firebase

Do not weaken Firestore rules to make a browser flow convenient. Design stable paths under `users/{uid}`, add emulator tests, and use trusted writes for credits and generated output.

### External providers

Hide YouTube, model, storage, contact, and payment providers behind small adapters. Translate provider-specific errors into stable application errors. Tests should use synthetic fixtures rather than live APIs.

## JavaScript and React conventions

- Prefer small functions with explicit inputs/outputs.
- Keep pure parsing/formatting separate from React components and Server Actions.
- Use `const` unless reassignment is needed.
- Remove unused imports and development logging.
- Provide stable keys for rendered collections.
- Define form defaults explicitly.
- Put validation at both browser and trusted server boundaries.
- Avoid importing browser Firebase composition into Server Components.
- Handle absent optional YouTube/Firestore fields defensively.
- Use strict equality.

The project is JavaScript today. A TypeScript migration should be incremental and preserve a green build; do not mix a full migration into an unrelated feature.

## Server Action contract

New or refactored actions should return:

~~~js
{ ok: true, data: value }
// or
{ ok: false, error: { code: "STABLE_CODE", message: "User-safe message" } }
~~~

Do not return raw Fetch responses, provider payloads, Error objects, or differently shaped failures from adjacent branches.

## Firestore changes

Every schema change requires:

- documented path and field contract;
- ownership/authority classification;
- Security Rule update;
- emulator tests;
- compatibility or migration plan;
- timestamp semantics;
- deletion/retention implications;
- pagination/index review for list queries.

Credit changes additionally require an append-only ledger, transaction tests, idempotency, and reconciliation semantics.

## UI and content changes

- Keep Italian product copy consistent or make an intentional localisation decision.
- Verify mobile, keyboard, light, and dark modes.
- Do not claim a feature, price, entitlement, usage number, accuracy level, or revision policy that code and operations do not enforce.
- Use fictional data in screenshots and fixtures.
- Include accessible labels, focus behaviour, and error states.
- Explain long-running work and partial failures.

## Testing expectations

Until a test stack is added, every change must at minimum complete a production build and receive a targeted manual smoke test. This is a temporary floor, not the desired standard.

The intended pre-merge sequence is:

~~~bash
npm run lint
npm run test
npm run build
~~~

Only `build` is non-interactively available today. See [Testing and releases](docs/TESTING_AND_RELEASES.md) for the required test layers.

## Manual smoke checklist

For changes affecting the existing flow:

1. open the anonymous landing;
2. verify the channel CTA prompts authentication;
3. create a synthetic test account;
4. confirm dashboard access and logout;
5. log back in;
6. resolve a canonical YouTube channel ID;
7. open and validate the generation form;
8. confirm expected failure boundary if generation remains unimplemented;
9. check browser/server logs contain no token or source content;
10. verify layout in light/dark and narrow/wide viewport.

## Pull request description

Include:

- user-visible outcome;
- implementation boundary changed;
- data/security implications;
- verification commands and results;
- known limitations;
- screenshots for visible UI changes;
- migration/deployment/rollback steps when relevant.

## Documentation

Documentation is part of the change:

- update workflow status when a step becomes implemented;
- update Server Action contracts when result shapes change;
- update the environment template for new variables;
- update the data model with every persisted field/path;
- record new external processors and secrets;
- update verified baseline only after rerunning checks;
- keep planned behaviour explicitly labelled.

## Definition of done

A change is complete when:

- behaviour is implemented end to end for its stated scope;
- trusted boundaries validate and authorise it;
- errors and partial failures are handled;
- tests cover success and meaningful failure branches;
- build/lint/test commands pass non-interactively;
- logs contain no sensitive content;
- documentation matches source;
- deployment and rollback are understood;
- unrelated user changes remain intact.
