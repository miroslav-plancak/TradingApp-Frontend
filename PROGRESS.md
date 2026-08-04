# PROGRESS

Resumable checkpoint for the Angular/ngRx port described in `AGENT_BRIEF.md`.
**Read `AGENT_BRIEF.md` first** — it holds the API surface, the DTO table, and the scope decisions.
This file records only what has actually been built and what to do next.

Last updated: 2026-08-04 — **all six phases complete**.

---

## Phase checklist

| # | Phase | Status |
|---|---|---|
| 1 | Repo + scaffold | **Done** |
| 2 | Orders feature (reference vertical slice) | **Done** |
| 3 | Outbox feature | **Done** |
| 4 | Dead Letter feature | **Done** |
| 5 | Scenarios feature | **Done** |
| 6 | Architecture/About page | **Done** |

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

## What Phase 4 delivered

`features/dead-letter/` follows Outbox closely (filtered list + `/stats` + per-row actions).
What is specific to it:

- **Two lookups, one slot.** `lookupById` and `lookupByClientOrderId` are separate actions hitting
  separate endpoints, but they share one `lookup` slot in state and one `lookupSuccess`/`lookupFailure`
  pair — only one result is ever on screen. Client order id is the id an operator usually has.
- **`ResolveDialog`** is a real form (`resolutionNotes` + `resolvedBy`, both required) rather than a
  confirm, and returns the request object; the container dispatches it. `mergeMap`, matching the
  per-row call in Outbox.
- **Resolution fields are only rendered when `isResolved`.** The create endpoint returns literal
  placeholder text — `resolutionNotes: "hardcoded ResolutionNotes"`, `resolvedBy: "hardcoded
  ResolvedBy"` — on a brand-new, unresolved entry. Showing them unconditionally would display
  fiction.
- **Inject form** defaults `clientOrderId` and `correlationId` to fresh GUIDs and regenerates them
  after each submit, so repeated injections don't collide. It exposes `category` and `correlationId`,
  which the original console's form omitted even though the DTO carries them.
- **Delete copy says deleting is not resolving** — the triage record goes with the row.
- `messageBody` renders through the same `shared/json-viewer-dialog/` as outbox payloads.
- Flattening operators unchanged from Phases 2–3: `switchMap` loads/lookups, `mergeMap` per-row
  resolve/delete, `exhaustMap` create and delete-all.

---

## What Phase 5 delivered

The only feature with **no ngRx slice**. A scenario run is a page-local, long-running process with an
append-only log — not shared application state — and it reads far better as sequential `async`/`await`
than as a chain of effects. State lives in two component-provided services:

- `scenario-runner.service.ts` — one `signal` holding a record of `ScenarioRun` (status, lines,
  timings), plus the six scripted sequences. It composes `OrdersApiService`, `OutboxApiService` and
  `DeadLetterApiService`; it issues no HTTP of its own.
- `burst-runner.service.ts` — the paced load generator with sent/success/failed counters and a
  live req/s figure.

Both are provided on the `Scenarios` component, so leaving the page destroys them — and their
`ngOnDestroy` **cancels anything in flight**, the same rule as the poll timers. Verified in the
browser: starting the idempotency probe and navigating away produced zero further requests.

Two bugs found and fixed during verification, both worth knowing about:

1. **`runFor(id)` built a new `computed` on every call.** It is called from the template, so every
   change-detection pass allocated a fresh signal node subscribed to the runs signal. With a run
   appending log lines several times a second the renderer wedged — screenshots timed out and cards
   rendered blank. Fixed by building one stable computed per scenario up front. **If you add a
   per-item signal accessor called from a template, memoize it.**
2. **Waits counted timer ticks, not wall-clock.** `setInterval(250)` plus `waited += 250` assumes
   every tick lands on time; browsers throttle timers, so a 60-second wait took 94 seconds and every
   reported duration and the drain-test timeout were wrong. Both runners now compare against a
   `Date.now()` deadline. After the fix a 20-second wait measured 20.1s.

Other decisions:

- Scenario **parameters are component state**, not service state — they are form values.
- Every scenario is cancellable; `sleep` wakes early so Stop feels immediate.
- The **purge utility** lives here in a "danger zone" card rather than the global toolbar, so it
  takes a deliberate visit to reach. It is the three delete-all calls in a `forkJoin` behind
  `ConfirmDialog`.
- The **manual chaos scenarios** from the original tab are carried over as static notes — they need
  services stopped or queues disabled and cannot be driven from the browser.
- The burst generator is **paced** (delay between submissions); the throughput scenario is the one
  that fires concurrently. Keeping those distinct is deliberate.

---

## What Phase 6 delivered

Static reference page, no state and no HTTP. Content is transcribed from **`TradingApp-AWS/README.md`**,
which was rewritten for the AWS port — deliberately *not* from the original console's architecture
tab, which still described the Azure/Service Bus original, and not re-derived from `Functions/*`.

`architecture.model.ts` holds the content as typed data; `architecture.html` renders it. Sections:
where things actually run (only SQS/SNS are cloud, SQL Server is local, no IaC), the order flow as a
connected pipeline, the DLQ path, the status lifecycle, the eight Lambdas (stubs badged), the eight
reliability patterns in an accordion, the seven tables, the AWS resources, the local harness
workflow, distributed tracing, the event contract, and the enum reference.

**When the backend changes, update the README first and mirror it here.** That ordering is the whole
point of sourcing it this way.

One config change: the `anyComponentStyle` budget went from 4 kB to 6 kB. This page's stylesheet is
4.6 kB — large for a component, reasonable for the app's only long-form document. Note that `.mono`
and the monospace `code` rule are now duplicated across several feature stylesheets; hoisting them
into `styles.scss` is the obvious cleanup if anyone touches this area again.

---

## Open questions carried into later phases

1. ~~**`DeadLetterCategory` wire format.**~~ **CLOSED in Phase 4, confirmed against the live API.**
   It is **numeric in both directions**: a real response carries `"category":1`, and posting
   `"category":"InfrastructureFailure"` is rejected with
   `400 … The JSON value could not be converted to TradingApp.Domain.Models.Enums.DeadLetterCategory`.
   The const-object enum `{ BusinessFailure: 0, InfrastructureFailure: 1 }` in
   `core/models/dead-letter.model.ts` is correct. Nothing to revisit unless a
   `JsonStringEnumConverter` is added to the API later.
2. **Base URL includes `/api`.** The brief gives the base as `https://localhost:7224/api`, while the
   original HTML's field holds `https://localhost:7224` and puts `/api` in each path. This app
   follows the brief: the editable field holds the full base *including* `/api`, so service calls
   are `apiConfig.url('/order')`. Anyone pasting a URL from the old console must append `/api`.
3. ~~**The real backend has never been reached from this app.**~~ **CLOSED in Phase 4.** The API was
   migrated off Azure Key Vault onto AWS Secrets Manager (`TradingApp-AWS` commit `7799874` on
   `dev`) and now starts locally. Orders, Outbox and Dead Letter have all been exercised against it.
   Two notes for whoever runs it next:
   - `dotnet run` picks the **http** launch profile (port 5275). Pass
     `--launch-profile https` to get `https://localhost:7224`, which is the base URL this app
     defaults to.
   - Two shape differences from the Phase 2/3 mock, both handled, neither a bug:
     `OutboxMessageResponse.payload` is a **bare client-order-id GUID**, not a JSON document, and
     `type` is a short name (`"OrderCreated"`), not a CLR type name. The JSON viewer only warns
     about unparseable content when it *starts* like JSON, so scalar payloads render plainly.
   - Dates come back as `2026-08-04T14:55:29.7137241+00:00` (7-digit fractional seconds plus
     offset). `Date` parses this fine; no custom handling needed.
4. **CORS is fine.** `Program.cs` registers an `AllowAll` policy (`AllowAnyOrigin/Method/Header`),
   so `localhost:4200` needs no proxy. The dev certificate still has to be accepted once in the
   browser, or every request fails as status 0.
5. **Bug in the *old* console, for the record — not ported.** Several functions in
   `TradingAppUI.html` build their paths with **backslashes** instead of slashes, e.g. line 2189
   `'\api\outboxmessage\' + id + '\mark-processed'`, and the same in `resolveDeadLetter` (2288),
   `createDeadLetter` (2301) and `deleteDeadLetterById` (2315). In JavaScript `\a`, `\o`, `\m`, `\d`
   and `\r` are just those letters, so those requests go to garbage relative paths — mark-processed,
   resolve, inject and delete-by-id have all been broken in the original UI. Nothing to fix in this
   repo; the port builds every path correctly and all four are verified working against the live
   API. Worth knowing only if someone compares behaviour against the old console.

---

## Conventions (followed throughout; keep to them for any further work)

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

## The brief is complete — what someone might pick up next

Nothing outstanding from `AGENT_BRIEF.md`. Every feature of the original console is carried over.
Ideas, in rough order of value:

1. **SignalR**, the seam the whole build was structured around. Replace each feature's `poll*$`
   effect with a hub subscription that dispatches the same `load*` action. Reducers, selectors and
   components need no changes — that was the point. The companion `SignalR_and_RealTime.html` doc in
   the sibling `fis learning` folder is the intended starting material.
2. **`PagePlaceholder` is now unused.** It was scaffolding for phases 2–6. Delete it, or keep it for
   a future seventh page — but do not leave it undecided indefinitely.
3. **Hoist the duplicated `.mono` / monospace `code` rules** out of the feature stylesheets into
   `styles.scss`. Five components define the same rule; that is also what pushed the architecture
   page over the old component-style budget.
4. **No component tests for the tables and forms.** Coverage today is reducers, selectors, HTTP
   contracts, the scenario runners, and the polling-stops-on-destroy behaviour. The presentational
   components are verified by eye, not by test.
5. ~~**The accessibility bar has not been audited with a tool.**~~ **Done — axe-core run over all
   five pages, every dialog, the snackbar and the API-unreachable error state. Zero violations.**
   Three real defects were found and fixed:
   - `button-name` (critical): the toolbar's reset button is icon-only, and `mat-icon` is
     `aria-hidden` while a tooltip only contributes a *description* — so it had no accessible name
     at all. It now has an explicit `aria-label`. **Any icon-only button needs one; a tooltip is
     not a substitute.**
   - `region`: the toolbar and tab strip sat outside every landmark, because `mat-tab-nav-bar` puts
     `role="tablist"` on the `<nav>` and destroys its navigation landmark. Both now live in a
     `<header>`, and `<main>` wraps the tab panel instead of sitting inside it.
   - `heading-order`: Scenarios jumped h1 → h3, since `mat-card-title` renders a plain `div`. The
     card titles on that page now contain real `<h2>`s styled with `font: inherit`.

   Colour contrast: 108 elements passed; the 21 "incomplete" results are Material's transparent
   inputs, which axe cannot resolve a background for. Computed manually — every one clears AA, the
   lowest being 9.87:1 (the green `#4ade80` on a card). The theme tokens all sit above 10:1.

   **This was a one-off scan, not a standing guard.** `axe-core` was installed, used, and removed.
   Wiring it into the Vitest suite would keep it honest — worth doing if this app grows.
6. **Deployment.** The brief mentions S3 + CloudFront; there is no pipeline, no `Dockerfile`, and no
   CI in this repo yet.

---

## Running it

```bash
npm start        # ng serve  -> http://localhost:4200 (redirects to /orders)
npm run build    # production build
npm test         # vitest, single run: npx ng test --watch=false
```

The backend must be running separately (a normal `app.Run()` ASP.NET Core app, not Lambda-hosted):

```bash
dotnet run --project ../TradingApp-AWS/TradingApp.API/TradingApp.API.csproj --launch-profile https
```

`--launch-profile https` matters: the default profile listens on `http://localhost:5275`, while this
app defaults to `https://localhost:7224`. Either accept the dev certificate in the browser once, or
point the toolbar's base-URL field at the http port — every request fails as status 0 otherwise.
Startup reads a secret from AWS Secrets Manager (`eu-north-1`), so it needs working AWS credentials.

**If the backend cannot run**, the console can be pointed at any stand-in through the base-URL field —
that field exists precisely for this. A small Node mock of the documented contract is enough to
exercise a whole feature slice; keep such a mock outside the repo.
