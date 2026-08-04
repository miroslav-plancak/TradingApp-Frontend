# PROGRESS

Resumable checkpoint for the Angular/ngRx port described in `AGENT_BRIEF.md`.
**Read `AGENT_BRIEF.md` first** — it holds the API surface, the DTO table, and the scope decisions.
This file records only what has actually been built and what to do next.

Last updated: 2026-08-04 (end of Phase 3).

---

## Phase checklist

| # | Phase | Status |
|---|---|---|
| 1 | Repo + scaffold | **Done** |
| 2 | Orders feature (reference vertical slice) | **Done** |
| 3 | Outbox feature | **Done** |
| 4 | Dead Letter feature | Not started |
| 5 | Scenarios feature | Not started |
| 6 | Architecture/About page | Not started |

---

## Stack and versions — read before upgrading anything

| Package | Version | Why |
|---|---|---|
| Angular / CLI | **21.2.19** | See below — deliberately *not* the newest release. |
| `@angular/material`, `@angular/cdk` | 21.2.14 | |
| `@ngrx/store`, `effects`, `entity`, `store-devtools` | 21.1.1 | |
| TypeScript | 5.9.x | |
| Node (dev machine) | 22.14.0 | |

**Angular 21, not 22 — two independent reasons:**

1. Angular 22 requires Node `^22.22.3 || ^24.15.0 || >=26`. This machine runs Node 22.14.0, and the
   CLI hard-refuses to run.
2. More importantly, ngRx's newest release is **v21** (`peerDependencies: @angular/core ^21.0.0`).
   There is no ngRx build for Angular 22, so v21 is the newest *coherent* Angular + ngRx + Material
   stack regardless of the Node version.

Upgrading Node alone is therefore not enough to move to Angular 22 — wait for an ngRx v22 release.

**Other stack notes:**

- The app is **zoneless** (Angular 21 default). `zone.js` is not a dependency. Use signals and
  `async` pipe; do not reach for anything that assumes Zone.js patching.
- **No `@angular/animations`.** Material v21 animates via CSS. Adding `provideAnimationsAsync()`
  fails the build with `Could not resolve "@angular/animations/browser"`. Do not re-add it.
- The `initial` bundle budget in `angular.json` was raised to 800 kB warn / 1.5 MB error — Material +
  ngRx put the baseline at ~565 kB, over the CLI's 500 kB default.
- File naming follows the CLI's 2025 style guide (`orders.ts`, class `Orders` — no `.component.ts`
  suffix). Stay consistent with that.

---

## What Phase 1 delivered

```
src/
  environments/
    environment.model.ts          Environment interface — a missing key is a compile error
    environment.ts                production defaults
    environment.development.ts    swapped in by angular.json fileReplacements
  app/
    app.ts / app.html / app.scss  shell: mat-toolbar + mat-tab-nav-bar + router-outlet
    app.config.ts                 root providers
    app.routes.ts                 lazy routes for the 5 tabs
    app.spec.ts                   asserts the 5 nav links render
    core/
      config/api-config.service.ts  runtime-editable API base URL
      models/                       order | outbox | dead-letter | common (+ index barrel)
    shared/
      page-placeholder/             scaffold-only card used by every unbuilt feature page
    features/
      orders/        orders.ts + orders.routes.ts    (placeholder)
      outbox/        outbox.ts + outbox.routes.ts    (placeholder)
      dead-letter/   dead-letter.ts + …              (placeholder)
      scenarios/     scenarios.ts + …                (placeholder)
      architecture/  architecture.ts + …             (placeholder)
```

- **Routing**: `app.routes.ts` lazy-loads a per-feature `*.routes.ts`. `''` and `**` both redirect to
  `/orders`. Verified genuinely lazy — the build emits a separate chunk per feature.
- **Models**: translated 1:1 from the brief's DTO table. `Guid` → `string`, `DateTimeOffset` →
  `string` (ISO 8601, parsed only at display time), ASP.NET camelCase property names, no envelope
  wrapper. `OrderStatus` is a string literal union (the DTO declares it `string`, so the enum's
  *name* crosses the wire).
- **Root providers** (`app.config.ts`): `provideHttpClient(withFetch())`,
  `provideRouter(routes, withComponentInputBinding())`, `provideStore()`, `provideEffects()`,
  `provideStoreDevtools()`. The root store is intentionally **empty** — feature slices register
  themselves lazily (see conventions below).
- **Theme**: Material 3 azure/blue via `mat.theme()` in `src/styles.scss`, with
  `color-scheme: dark` on `body` to match the original VS-Code-dark console. Porting the exact
  original visual design is still a nice-to-have, not a requirement.
- **Verified**: `npm run build` succeeds with no warnings; `npm test` passes. `npm start` boots
  and serves.

---

## What Phase 2 delivered — the reference vertical slice

`features/orders/` is the pattern Phases 3 and 4 copy. Read it before writing either of them.

```
features/orders/
  orders.ts / .html / .scss     container: selects + dispatches, holds no state
  orders.routes.ts              lazy route + provideState/provideEffects
  orders-api.service.ts         one method per endpoint, nothing else
  orders-api.service.spec.ts    locks verb + path + body for all five endpoints
  orders.spec.ts                container lifecycle (load on init, stop polling on destroy)
  store/
    orders.actions.ts           createActionGroup
    orders.reducer.ts           createFeature + createEntityAdapter
    orders.selectors.ts         feature selectors + derived counts
    orders.effects.ts           functional effects (load/create/lookup/delete/poll/notify)
    orders.reducer.spec.ts      reducer + selector behaviour
  components/
    order-create-form/          reactive form, emits CreateOrderRequest
    order-lookup/               GUID-validated id input + detail grid
    orders-table/               MatTable, per-row delete
```

Also added in `core/` and `shared/`, reusable by every later phase:

- `core/api/http-error.ts` — `toErrorMessage()`. Handles **both** backend error shapes:
  `ExceptionHandlingMiddleware` serializes `ProblemDetails` with the default (non-web) serializer, so
  its keys are **PascalCase** (`Detail`, `Title`), while `[ApiController]` validation errors are
  camelCase with an `errors` map. Status 0 gets a dedicated "is the API running / cert accepted"
  message, which is the failure operators actually hit.
- `core/notifications/notification.service.ts` — the toast port (`MatSnackBar`). Errors are
  `assertive` and stay 10s; successes are `polite` and stay 4s.
- `shared/confirm-dialog/` — used by every destructive action (and by the Scenarios purge later).
- `shared/order-status-chip/` — colour + text, never colour alone.
- `.visually-hidden` and the snackbar variant classes in `src/styles.scss`.

**Decisions worth keeping consistent:**

- **Effects are functional** (`createEffect(..., { functional: true })`, registered with
  `import * as ordersEffects`). Less boilerplate than the class form and what ngRx leads with now.
- **Flattening operator per effect is deliberate**: `switchMap` for list loads and lookup (a newer
  request supersedes an older one), `exhaustMap` for create and delete-all (ignore double submits),
  `mergeMap` for single-row delete (concurrent row deletes must not cancel each other).
- **`selectIsInitialLoading`** is `loading && count === 0`, so a 5s poll never blanks the table.
- **Empty vs error**: the table renders when there are rows; the empty state only when a load
  actually succeeded with none. A failed load shows an inline banner with Retry, and
  `loadOrdersFailure` deliberately does **not** raise a snackbar — a failing poll would otherwise
  produce a toast every 5 seconds.
- **Create** upserts optimistically then dispatches `loadOrders` to reconcile, because the order's
  real status is set asynchronously by the pipeline.

---

## What Phase 3 delivered

`features/outbox/` follows `features/orders/` file for file — same container/presentational split, same
store layout, same effect shapes. Only the differences are worth reading:

- **The filter is state, not three action families.** `filter: 'all' | 'unprocessed' | 'processed'`
  lives in the slice; `OutboxApiService.list(filter)` maps it onto the three endpoints, and
  `filterChanged` clears the rows immediately so the previous filter's messages can't sit under the
  new filter's heading while the request is in flight.
- **List and stats load as one unit.** `loadOutbox` fans out to `/outboxmessage[...]` and
  `/stats` via `forkJoin`, landing in a single `loadOutboxSuccess({ messages, stats })`. They fail
  together on purpose: a page showing half the truth is worse than one showing an error. Note the
  stats are **global** while the table is filtered, so they will legitimately disagree.
- **`reloadAfterMutation$`** re-runs the load after mark-processed, delete, and delete-all, because
  `/stats` counts every message and the reducer cannot recompute it from the filtered rows.
- **Flattening operators match Phase 2 exactly** — `switchMap` for loads and lookup, `mergeMap` for
  the per-row actions (mark-processed, delete), `exhaustMap` for delete-all.
- **`markProcessedSuccess` removes the row when the filter is `unprocessed`**, since the message no
  longer belongs in that view.
- **Payload rendering** goes through the new `shared/json-viewer-dialog/`, which pretty-prints
  best-effort and falls back to the raw string with a warning when it will not parse — Phase 4
  reuses it verbatim for `DeadLetterLogResponse.messageBody`.
- **`retryCount >= 5`** (the processor's quarantine threshold, exported as
  `QUARANTINE_RETRY_THRESHOLD`) renders as a filled error chip, plus a banner above the table. That
  banner counts **loaded rows only** — there is no server-side stat for retry counts — and its
  wording says so.
- Mark-processed is behind a confirmation, because it tells the pipeline a message was dispatched
  when it was not.
- The original tab's static "How Outbox Works" note is carried over as a card.

---

## Open questions carried into later phases

1. **`DeadLetterCategory` wire format — verified statically, not at runtime.** The brief asked for a
   runtime check; the local API at `https://localhost:7224` was **not running** during Phase 1.
   Static evidence: no `JsonStringEnumConverter` is registered anywhere in `TradingApp-AWS` (the
   solution's only `JsonSerializerOptions` lives in `TradingAppLogger.cs`, not in the API's
   `Program.cs`), so System.Text.Json's **numeric** default applies. Modelled accordingly as a
   const-object enum `{ BusinessFailure: 0, InfrastructureFailure: 1 }`.
   **Phase 4 must re-confirm against one real response.** If it turns out to be a string, only
   `core/models/dead-letter.model.ts` (the type plus its label map) changes.
2. **Base URL includes `/api`.** The brief gives the base as `https://localhost:7224/api`, while the
   original HTML's field holds `https://localhost:7224` and puts `/api` in each path. This app
   follows the brief: the editable field holds the full base *including* `/api`, so service calls
   are `apiConfig.url('/order')`. Anyone pasting a URL from the old console must append `/api`.
3. **The real backend has never been reached from this app.** `TradingApp.API` cannot start on this
   machine: `Program.cs` line 19 loads configuration from Azure Key Vault at startup and
   `DefaultAzureCredential` fails every credential (the Azure CLI login is against a different
   tenant — `az login --tenant d5508570-…` would be needed, and it is interactive). Phase 2 was
   therefore verified against a throwaway Node mock of the `/api/order` contract in the session
   scratchpad, pointed at via the console's editable base URL. Everything matching the brief's table
   is exercised, but **the first run against the real API may still surface shape surprises** —
   especially date formats and `DeadLetterCategory` (see item 1). Re-check when the backend runs.
4. **CORS is fine.** `Program.cs` registers an `AllowAll` policy (`AllowAnyOrigin/Method/Header`),
   so `localhost:4200` needs no proxy. The dev certificate still has to be accepted once in the
   browser, or every request fails as status 0.
5. **Bug in the *old* console, for the record — not ported.** `TradingAppUI.html:2189`
   (`markOutboxProcessed`) builds its path with backslashes:
   `'\api\outboxmessage\' + id + '\mark-processed'`. In JavaScript `\a`, `\o` and `\m` are just
   those letters, so the request goes to a garbage relative path and mark-processed has been broken
   in the original UI. Nothing to fix in this repo — the port builds the path correctly — but worth
   knowing if anyone compares behaviour against the old console. The backend endpoint itself is
   fine.

---

## Conventions the later phases must follow

- **Components**: standalone, `inject()` for DI, `@if`/`@for` control flow (never `*ngIf`/`*ngFor`),
  `ChangeDetectionStrategy.OnPush`, signal `input()`/`output()`.
- **State**: one `@ngrx/entity` slice per domain under `features/<name>/store/`
  (`*.actions.ts`, `*.reducer.ts`, `*.selectors.ts`, `*.effects.ts`). Register it **lazily** in the
  feature's `*.routes.ts` via `providers: [provideState(...), provideEffects(...)]` — the root store
  stays empty, so a feature's state arrives with its chunk.
- **HTTP**: every request goes through `ApiConfigService.url(path)`; nothing else builds URLs. That
  service is the seam where a generated OpenAPI client could take over later.
- **Polling**: implement as a *single* effect per feature driven by an RxJS `timer()` that dispatches
  the same `load*` action the manual refresh button dispatches (default interval:
  `environment.pollIntervalMs`, 5000 ms — mirrors the old "Auto 5s" buttons). Reducers, selectors,
  and components must have **zero awareness of how updates arrive** — that is the seam SignalR
  replaces later. Do not couple anything else to the trigger. See `pollOrders$`.
- **Stop the timer in the container's `ngOnDestroy`.** Route-level `provideState`/`provideEffects`
  are **not** torn down when the route is deactivated — measured in the browser: with auto-refresh
  on, leaving `/orders` kept the API polled from the Outbox tab indefinitely. Re-entering the route
  does *not* register the effects a second time, so the only leak is the running timer. Every
  feature with a polling toggle must dispatch `autoRefreshToggled({ enabled: false })` on destroy;
  `orders.spec.ts` has the regression test to copy.
- **Scenarios (phase 5)** are not entity-shaped. Model per-scenario run state (idle/running/output
  log) as a small dedicated slice or plain component state; don't force `EntityAdapter` onto it.
- **Backend is read-only.** Do not modify `TradingApp-AWS`. If something would be easier with a new
  endpoint, flag it rather than building around it silently.
- Out of scope throughout: real SignalR, auth, and any backend change.

---

## Next step — Phase 4 (Dead Letter)

Closest to Outbox: filtered list (`all` / `unresolved`), a `/stats` endpoint loaded alongside it,
per-row actions, and a JSON body to inspect. Copy `features/outbox/` and adapt.

1. **Re-verify `DeadLetterCategory` on the wire before writing any of it** — see open question 1.
   One real response settles whether the model stays a numeric enum.
2. **Endpoints** (`DeadLetterController`): list, `/unresolved`, `/{id}`, `POST /{id}/resolve`,
   `/stats`, `/by-client-order/{clientOrderId}`, `POST` create, `DELETE /{id}`, `DELETE` all.
3. **Two lookups, not one**: by id *and* by client order id. They are separate endpoints returning
   the same DTO — one lookup slot in state with an action per endpoint is enough.
4. **Resolve dialog**: `ResolveDeadLetterRequestDTO` is `{ resolutionNotes, resolvedBy }` — a real
   form in a dialog, not a bare confirm. `exhaustMap`, like create in Orders.
5. **Manual inject form**: `CreateDeadLetterRequestDTO` needs `clientOrderId`, `messageBody`,
   `reason`, `category`, `correlationId`. It exists to generate test data, so default the GUIDs to
   freshly generated ones rather than making the operator invent them.
6. **`messageBody`** renders through `shared/json-viewer-dialog/` exactly as outbox payloads do.

Then Phase 5 (Scenarios) and Phase 6 (Architecture).

---

## Running it

```bash
npm start        # ng serve  -> http://localhost:4200 (redirects to /orders)
npm run build    # production build
npm test         # vitest, single run: npx ng test --watch=false
```

The backend must be running separately: `TradingApp.API` at `https://localhost:7224`
(a normal `app.Run()` ASP.NET Core app, not Lambda-hosted). Accept its dev certificate in the
browser once, or every request fails as status 0.

**If the backend will not start** (Key Vault / `DefaultAzureCredential`, see open question 3), the
console can be pointed at any stand-in through the toolbar's base-URL field — that field exists
precisely for this. A minimal Node mock of the `/api/order` contract is enough to exercise the whole
Orders slice; keep such a mock outside the repo.
