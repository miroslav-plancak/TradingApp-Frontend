import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  EMPTY,
  catchError,
  exhaustMap,
  forkJoin,
  map,
  mergeMap,
  of,
  switchMap,
  tap,
  timer,
  withLatestFrom,
} from 'rxjs';

import { toErrorMessage } from '../../../core/api/http-error';
import { ApiConfigService } from '../../../core/config/api-config.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { OrderStatusHubService } from '../../../core/signalr/order-status-hub.service';
import { DeadLetterApiService } from '../dead-letter-api.service';
import { DeadLetterActions } from './dead-letter.actions';
import { selectFilter } from './dead-letter.selectors';

/** List and stats as one unit, exactly as in Outbox. */
export const loadDeadLetters$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(DeadLetterApiService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.loadDeadLetters),
      withLatestFrom(store.select(selectFilter)),
      switchMap(([, filter]) =>
        forkJoin({ entries: api.list(filter), stats: api.stats() }).pipe(
          map(({ entries, stats }) => DeadLetterActions.loadDeadLettersSuccess({ entries, stats })),
          catchError((error: unknown) =>
            of(DeadLetterActions.loadDeadLettersFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const reloadOnFilterChange$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(DeadLetterActions.filterChanged),
      map(() => DeadLetterActions.loadDeadLetters()),
    ),
  { functional: true },
);

export const lookupById$ = createEffect(
  (actions$ = inject(Actions), api = inject(DeadLetterApiService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.lookupById),
      switchMap(({ id }) =>
        api.getById(id).pipe(
          map((entry) => DeadLetterActions.lookupSuccess({ entry })),
          catchError((error: unknown) =>
            of(
              DeadLetterActions.lookupFailure({
                error: toErrorMessage(error, `No dead letter found for id ${id}`),
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const lookupByClientOrderId$ = createEffect(
  (actions$ = inject(Actions), api = inject(DeadLetterApiService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.lookupByClientOrderId),
      switchMap(({ clientOrderId }) =>
        api.getByClientOrderId(clientOrderId).pipe(
          map((entry) => DeadLetterActions.lookupSuccess({ entry })),
          catchError((error: unknown) =>
            of(
              DeadLetterActions.lookupFailure({
                error: toErrorMessage(
                  error,
                  `No dead letter found for client order ${clientOrderId}`,
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const resolveEntry$ = createEffect(
  (actions$ = inject(Actions), api = inject(DeadLetterApiService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.resolveEntry),
      // mergeMap: a per-entry action, like Outbox's mark-processed. Several
      // entries may be resolved in quick succession without cancelling.
      mergeMap(({ id, request }) =>
        api.resolve(id, request).pipe(
          map((entry) => DeadLetterActions.resolveEntrySuccess({ entry })),
          catchError((error: unknown) =>
            of(DeadLetterActions.resolveEntryFailure({ id, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const createEntry$ = createEffect(
  (actions$ = inject(Actions), api = inject(DeadLetterApiService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.createEntry),
      // exhaustMap: ignore repeat submits, as with Orders' create.
      exhaustMap(({ request }) =>
        api.create(request).pipe(
          map((entry) => DeadLetterActions.createEntrySuccess({ entry })),
          catchError((error: unknown) =>
            of(DeadLetterActions.createEntryFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteEntry$ = createEffect(
  (actions$ = inject(Actions), api = inject(DeadLetterApiService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.deleteEntry),
      mergeMap(({ id }) =>
        api.delete(id).pipe(
          map(() => DeadLetterActions.deleteEntrySuccess({ id })),
          catchError((error: unknown) =>
            of(DeadLetterActions.deleteEntryFailure({ id, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteAllEntries$ = createEffect(
  (actions$ = inject(Actions), api = inject(DeadLetterApiService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.deleteAllEntries),
      exhaustMap(() =>
        api.deleteAll().pipe(
          map(({ deletedCount }) => DeadLetterActions.deleteAllEntriesSuccess({ deletedCount })),
          catchError((error: unknown) =>
            of(DeadLetterActions.deleteAllEntriesFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

/** `/stats` covers every entry, so it cannot be recomputed from the filtered rows. */
export const reloadAfterMutation$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        DeadLetterActions.resolveEntrySuccess,
        DeadLetterActions.createEntrySuccess,
        DeadLetterActions.deleteEntrySuccess,
        DeadLetterActions.deleteAllEntriesSuccess,
      ),
      map(() => DeadLetterActions.loadDeadLetters()),
    ),
  { functional: true },
);

/** The one place that knows updates can arrive on a timer. See `pollOrders$`. */
export const pollDeadLetters$ = createEffect(
  (actions$ = inject(Actions), config = inject(ApiConfigService)) =>
    actions$.pipe(
      ofType(DeadLetterActions.autoRefreshToggled),
      switchMap(({ enabled }) =>
        enabled
          ? timer(0, config.pollIntervalMs).pipe(map(() => DeadLetterActions.loadDeadLetters()))
          : EMPTY,
      ),
    ),
  { functional: true },
);

export const notifySuccess$ = createEffect(
  (actions$ = inject(Actions), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        DeadLetterActions.resolveEntrySuccess,
        DeadLetterActions.createEntrySuccess,
        DeadLetterActions.deleteEntrySuccess,
        DeadLetterActions.deleteAllEntriesSuccess,
      ),
      tap((action) => {
        switch (action.type) {
          case DeadLetterActions.resolveEntrySuccess.type:
            notifications.success('Dead letter resolved');
            break;
          case DeadLetterActions.createEntrySuccess.type:
            notifications.success(`Dead letter injected — id ${action.entry.id}`);
            break;
          case DeadLetterActions.deleteEntrySuccess.type:
            notifications.success('Dead letter deleted');
            break;
          case DeadLetterActions.deleteAllEntriesSuccess.type:
            notifications.success(
              `Deleted ${action.deletedCount} dead letter${action.deletedCount === 1 ? '' : 's'}`,
            );
            break;
        }
      }),
    ),
  { functional: true, dispatch: false },
);

/** `loadDeadLettersFailure` is excluded — it renders inline, and a failing poll would toast forever. */
export const notifyFailure$ = createEffect(
  (actions$ = inject(Actions), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        DeadLetterActions.resolveEntryFailure,
        DeadLetterActions.createEntryFailure,
        DeadLetterActions.deleteEntryFailure,
        DeadLetterActions.deleteAllEntriesFailure,
      ),
      tap(({ error }) => notifications.error(error)),
    ),
  { functional: true, dispatch: false },
);

/**
 * The push-based counterpart to pollDeadLetters$ above. `hub.connect()` is a
 * no-op if another feature's effect already connected - one shared connection.
 */
export const signalRPush$ = createEffect(
  (hub = inject(OrderStatusHubService)) => {
    hub.connect();
    return hub.deadLetterLogChanged$.pipe(map((entry) => DeadLetterActions.entryPushed({ entry })));
  },
  { functional: true },
);
