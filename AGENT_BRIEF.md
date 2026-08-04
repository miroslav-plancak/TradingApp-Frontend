# Brief: Port TradingApp's ops console from a single HTML/JS file to an Angular + ngRx app

## Context (read this before touching anything)

`TradingApp-AWS/UI/TradingAppUI.html` (2,687 lines) is a hand-built, single-file HTML/CSS/vanilla-JS
console that exercises the real `TradingApp.API` backend (ASP.NET Core, runs locally at
`https://localhost:7224`, not Lambda-hosted — confirmed via `Program.cs`, it's a normal `app.Run()`
web app). It is **not** a customer-facing trading UI — it's a developer/ops dashboard: create/inspect
orders, watch the outbox drain, inspect/resolve dead-lettered messages, and run canned integration-test
scenarios against the live event-driven pipeline (Lambda functions in `TradingApp-AWS/Functions/*`).

**Goal**: rebuild this as a real Angular application with ngRx state management, in a **brand-new,
standalone git repository** — not inside `TradingApp-AWS`. Reasons this is a separate repo: different
toolchain (npm/Angular CLI vs dotnet/NuGet), different CI/deploy pipeline (this app deploys to
static hosting like S3+CloudFront, not Lambda), different release cadence, and to avoid polluting the
backend repo's git history with frontend churn.

**Scope decision already made — carry every existing feature over, nothing gets cut for v1**:
Orders, Outbox, Dead Letter, Scenarios (the 6 canned test runners + burst load test), and the static
Architecture/About page all stay. The "purge database" destructive dev utility stays too.

**Explicitly out of scope for this build** — do not implement:
- Real SignalR / push-based live updates. Keep the existing "poll every N seconds" behavior, but
  structure the effect so swapping the trigger source later (timer → Hub push) doesn't touch anything
  except that one effect — reducers, selectors, and components must have zero awareness of *how*
  updates arrive. (There's a dedicated `SignalR_and_RealTime.html` doc, in the sibling `fis learning`
  folder, this will hook into when that's tackled as its own task — not now.)
- Any changes to `TradingApp-AWS` (the .NET/Lambda backend). This build only *consumes* the existing
  API — don't modify controllers, DTOs, or add endpoints, even if something would be more convenient
  with a new endpoint. Flag it instead of building around it silently.
- Real authentication (there's no auth layer today — don't invent one).

## Real API surface — this is ground truth, verified against the actual controllers

Base URL for local dev: `https://localhost:7224/api` (matches the existing HTML's `apiBaseUrl` field —
keep that as a configurable, editable value in the new app too, not hardcoded, since it's genuinely
useful for pointing at different environments later).

All endpoints return raw JSON directly (`Ok(result)`) — **no envelope wrapper** (no `{ success, data }`
shape anywhere). Model responses 1:1 against the DTOs below.

### `/api/order` (`OrderController`)
| Method | Route | Request body | Response |
|---|---|---|---|
| POST | `/api/order` | `CreateOrderRequestDTO` | `CreatedOrderResponseDTO` |
| GET | `/api/order/{orderId}` | — | `OrderResponseDTO` (404 if missing) |
| GET | `/api/order` | — | `OrderResponseDTO[]` |
| DELETE | `/api/order/{orderId}` | — | `boolean` (404 if missing) |
| DELETE | `/api/order` | — | `{ deletedCount: number }` |

### `/api/outboxmessage` (`OutboxMessageController`)
| Method | Route | Request body | Response |
|---|---|---|---|
| GET | `/api/outboxmessage` | — | `OutboxMessageResponseDTO[]` |
| GET | `/api/outboxmessage/unprocessed` | — | `OutboxMessageResponseDTO[]` |
| GET | `/api/outboxmessage/processed` | — | `OutboxMessageResponseDTO[]` |
| GET | `/api/outboxmessage/stats` | — | `OutboxMessageStatsDTO` |
| GET | `/api/outboxmessage/{id}` | — | `OutboxMessageResponseDTO` (404 if missing) |
| POST | `/api/outboxmessage/{id}/mark-processed` | — | `OutboxMessageResponseDTO` (404 if missing) |
| DELETE | `/api/outboxmessage/{id}` | — | `OutboxMessageResponseDTO` (404 if missing) |
| DELETE | `/api/outboxmessage` | — | `{ deletedCount: number }` |

### `/api/deadletter` (`DeadLetterController`)
| Method | Route | Request body | Response |
|---|---|---|---|
| GET | `/api/deadletter` | — | `DeadLetterLogResponseDTO[]` |
| GET | `/api/deadletter/unresolved` | — | `DeadLetterLogResponseDTO[]` |
| GET | `/api/deadletter/{id}` | — | `DeadLetterLogResponseDTO` (404 if missing) |
| POST | `/api/deadletter/{id}/resolve` | `ResolveDeadLetterRequestDTO` | `DeadLetterLogResponseDTO` (404 if missing) |
| GET | `/api/deadletter/stats` | — | `DeadLetterStatsDTO` |
| GET | `/api/deadletter/by-client-order/{clientOrderId}` | — | `DeadLetterLogResponseDTO` (404 if missing) |
| POST | `/api/deadletter` | `CreateDeadLetterRequestDTO` | `DeadLetterLogResponseDTO` |
| DELETE | `/api/deadletter/{id}` | — | `DeadLetterLogResponseDTO` (404 if missing) |
| DELETE | `/api/deadletter` | — | `{ deletedCount: number }` |

### DTO shapes → TypeScript models (translate these exactly, this is the real C# shape)

```csharp
// Order
class CreateOrderRequestDTO   { int Quantity; decimal Price; }
class CreatedOrderResponseDTO { Guid Id; Guid ClientOrderId; string Status; int Quantity; decimal Price;
                                 DateTimeOffset CreatedAt; DateTimeOffset UpdatedAt; bool IsProcessed;
                                 string CorrelationId; }
class OrderResponseDTO        { Guid Id; Guid ClientOrderId; string Status; int Quantity; decimal Price;
                                 DateTimeOffset CreatedAt; DateTimeOffset UpdatedAt; bool IsProcessed; }

// Outbox
class OutboxMessageResponseDTO { Guid Id; string Type; string Payload; DateTimeOffset CreatedAt;
                                  DateTimeOffset? ProcessedAt; int RetryCount; bool IsProcessed; }
class OutboxMessageStatsDTO    { int TotalCount; int ProcessedCount; int UnprocessedCount; int Last24Hours; }

// DeadLetter
class CreateDeadLetterRequestDTO  { Guid ClientOrderId; string MessageBody; string Reason;
                                     DeadLetterCategory Category; string CorrelationId; }
class ResolveDeadLetterRequestDTO { string ResolutionNotes; string ResolvedBy; }
class DeadLetterLogResponseDTO    { Guid Id; Guid ClientOrderId; string Reason; DeadLetterCategory Category;
                                     DateTimeOffset CreatedAt; bool IsResolved; string ResolutionNotes;
                                     DateTimeOffset? ResolvedAt; string ResolvedBy; string MessageBody;
                                     string CorrelationId; }
class DeadLetterStatsDTO          { int TotalCount; int UnresolvedCount; int ResolvedCount; int Last24Hours; }
```

Important: `OrderResponseDTO.Status` and `CreatedOrderResponseDTO.Status` are `string`, **not** a
numeric enum — the wire format is the enum's name. Model it in TypeScript as a string literal union,
not a `number` enum:
```ts
type OrderStatus = 'PENDING_ACK' | 'ACKNOWLEDGED' | 'REJECTED' | 'FILLED';
```
`DeadLetterCategory` on the wire — verify at runtime whether it serializes as string or int (check one
real response before assuming; the C# enum is `BusinessFailure = 0, InfrastructureFailure = 1` but
System.Text.Json's default is numeric unless a `JsonStringEnumConverter` is configured somewhere in
`TradingApp.API`'s `Program.cs` — check before typing this one).

`Guid` → `string` in TypeScript. `DateTimeOffset` → `string` (ISO 8601) in TypeScript, parse to `Date`
only where actually displayed/formatted.

## What to build, structurally

- **Angular CLI, latest stable, standalone components** (no NgModules) — `inject()`-based DI, functional
  HTTP interceptors, the `@if`/`@for` control-flow syntax, not `*ngIf`/`*ngFor`.
- **ngRx**: `@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/store-devtools`. `@ngrx/entity` is a
  strong fit here specifically — Orders, Outbox, and DeadLetter are all "list of entities with CRUD +
  a stats summary" shapes, which is exactly what `EntityAdapter` is for. One feature slice per domain
  (`orders`, `outbox`, `deadLetter`), each with its own actions/reducer/selectors/effects, plus a small
  `scenarios` slice for the test-runner state (these aren't entity-shaped, just in-flight/output-log
  state per scenario).
- **Angular Material + CDK** for the UI kit (tables, tabs, dialogs, snackbar for the existing toast
  system) — faster and more consistent than hand-rolling components, and this was already covered in
  the companion `Angular.html` learning doc, so the patterns should be familiar rather than novel.
- **Routing**: lazy-loaded feature routes matching the 5 existing tabs (`/orders`, `/outbox`,
  `/dead-letter`, `/scenarios`, `/architecture`), not one giant component with tab-switching state —
  this is a meaningfully better structure than what the tab-bar `data-tab` JS does today.
- **A shared `ApiService`** (or one per feature, your call) wrapping `HttpClient` against the table
  above — this is the seam where a generated OpenAPI client could replace hand-written calls later,
  keep it isolated.
- **Live updates**: an effect that polls on an RxJS `interval()`/`timer()`, toggle-able per feature
  (mirrors the existing "Auto 5s" buttons), dispatching the same `load*` action a manual refresh
  button would dispatch. This is the seam SignalR replaces later — don't couple anything else to *how*
  the reload gets triggered.
- **Dark theme**: the existing HTML has a full VS-Code-dark-style theme system with a theme switcher —
  porting the exact visual design is a nice-to-have, not a requirement; use Angular Material's theming
  system rather than hand-rolled CSS custom properties if you rebuild it.

## Phasing — this is not a one-shot build, treat it as a resumable checklist

Do not attempt this in a single pass. Work through these phases in order, and after finishing each
one, update a `PROGRESS.md` file in the new repo's root recording what's done and what's next — if
this session gets interrupted (context limit, credit limit, whatever), the next session should be able
to read `PROGRESS.md` and this file and continue without re-deriving any of the above.

1. **Repo + scaffold**: `ng new`, add ngRx/Material packages, set up folder structure
   (`core/`, `shared/`, `features/orders`, `features/outbox`, `features/dead-letter`,
   `features/scenarios`, `features/architecture`), routing shell with empty routed components,
   environment config (`apiBaseUrl`). Write the TypeScript models from the table above into
   `core/models/`. Get it building and running with an empty shell before writing any feature logic.
2. **Orders feature**: full vertical slice — model, `ApiService` methods, ngRx entity slice
   (actions/reducer/selectors/effects), list component + create-order form + lookup-by-id, polling
   toggle. This is the reference implementation the next two phases copy the pattern from.
3. **Outbox feature**: same vertical slice pattern as Orders.
4. **Dead Letter feature**: same pattern, plus the resolve-dialog and manual-create-for-testing form.
5. **Scenarios feature**: the 6 canned test runners + burst order creation. These aren't ngRx-entity
   shaped — model each scenario's run state (idle/running/output-log) as a small dedicated slice or
   even local component state if that's cleaner; don't force the entity pattern where it doesn't fit.
6. **Architecture/About page**: static content, lowest priority, do last.

After phase 1, confirm the scaffold builds and looks right before continuing — don't chain straight
through to phase 6 without a checkpoint.
