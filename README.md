# TradingApp Ops Console

A developer/ops dashboard for the `TradingApp` event-driven pipeline — **not** a customer-facing
trading UI. It creates and inspects orders, watches the transactional outbox drain, triages
dead-lettered messages, and runs canned integration-test scenarios against the live backend.

This is an Angular + ngRx rebuild of the single-file
`TradingApp-AWS/UI/TradingAppUI.html` console, in its own repository (different toolchain, different
deploy target — static hosting rather than Lambda).

**Status: scaffold only.** Phase 1 of 6 is complete; the five feature pages are placeholders.
See [`PROGRESS.md`](./PROGRESS.md) for what's built and what's next, and
[`AGENT_BRIEF.md`](./AGENT_BRIEF.md) for the API surface, DTO table, and scope decisions.

## Prerequisites

- Node.js — currently pinned below Angular 22 by the toolchain; see `PROGRESS.md` for the version
  constraints before upgrading anything.
- The backend running locally: `TradingApp.API` at **`https://localhost:7224`** (a normal
  ASP.NET Core `app.Run()` web app). Visit it once in the browser and accept the dev certificate,
  otherwise requests from this console fail at the network layer with no useful error.

## Running

```bash
npm install
npm start        # dev server on http://localhost:4200 (redirects to /orders)
npm run build    # production build into dist/
npm test         # unit tests (Vitest); add -- --watch=false for a single run
```

## API base URL

`environment.apiBaseUrl` (`https://localhost:7224/api`) is only the **default**. The toolbar has an
editable base-URL field so the console can be pointed at another environment without a rebuild; the
override persists in `localStorage`, and the reset button restores the default.

Note the `/api` segment is part of the base URL here, unlike the original HTML console where it was
part of each request path.

## Layout

| Path | Contents |
|---|---|
| `src/app/core/` | Models translated from the backend DTOs, API configuration |
| `src/app/shared/` | Reusable presentational pieces |
| `src/app/features/` | One lazy-loaded folder per tab: orders, outbox, dead-letter, scenarios, architecture |
| `src/environments/` | Build-time configuration (`apiBaseUrl`, poll interval) |

Conventions for new code — standalone components, `inject()`, `@if`/`@for`, one `@ngrx/entity` slice
per domain registered lazily — are documented in `PROGRESS.md`.
