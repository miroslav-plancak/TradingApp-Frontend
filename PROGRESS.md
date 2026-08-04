# PROGRESS

Resumable checkpoint for the Angular/ngRx port described in `AGENT_BRIEF.md`.
**Read `AGENT_BRIEF.md` first** — it holds the API surface, the DTO table, and the scope decisions.
This file records only what has actually been built and what to do next.

Last updated: 2026-08-04 (end of Phase 1).

---

## Phase checklist

| # | Phase | Status |
|---|---|---|
| 1 | Repo + scaffold | **Done** |
| 2 | Orders feature (reference vertical slice) | Not started |
| 3 | Outbox feature | Not started |
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
- **Verified**: `npm run build` succeeds with no warnings; `npm test` passes 2/2. `npm start` boots
  and serves.

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
3. **Nothing is committed yet.** Only `AGENT_BRIEF.md` is in git history; the whole scaffold is
   uncommitted working tree, awaiting review.

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
  replaces later. Do not couple anything else to the trigger.
- **Scenarios (phase 5)** are not entity-shaped. Model per-scenario run state (idle/running/output
  log) as a small dedicated slice or plain component state; don't force `EntityAdapter` onto it.
- **Backend is read-only.** Do not modify `TradingApp-AWS`. If something would be easier with a new
  endpoint, flag it rather than building around it silently.
- Out of scope throughout: real SignalR, auth, and any backend change.

---

## Next step — Phase 2 (Orders)

Build the full vertical slice that Phases 3 and 4 will copy:

1. `features/orders/orders.service.ts` (or a shared `core/api/`) covering `POST /order`,
   `GET /order`, `GET /order/{id}`, `DELETE /order/{id}`, `DELETE /order`.
2. `features/orders/store/` — entity slice with actions/reducer/selectors/effects.
3. Register state + effects lazily in `orders.routes.ts`.
4. Components: order list (`MatTable`), create-order form (quantity + price), lookup-by-id,
   delete one / delete all, auto-refresh toggle.
5. Errors surface through `MatSnackBar` (the port of the old toast system).
6. Replace the `PagePlaceholder` usage in `orders.html`. Keep the component itself — the other
   unbuilt pages still use it.

---

## Running it

```bash
npm start        # ng serve  -> http://localhost:4200 (redirects to /orders)
npm run build    # production build
npm test         # vitest, single run: npx ng test --watch=false
```

The backend must be running separately: `TradingApp.API` at `https://localhost:7224`
(a normal `app.Run()` ASP.NET Core app, not Lambda-hosted). Accept its dev certificate in the
browser once, or requests from the console will fail silently at the network layer.
