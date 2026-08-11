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
import { OutboxApiService } from '../outbox-api.service';
import { OutboxActions } from './outbox.actions';
import { selectFilter } from './outbox.selectors';

/**
 * List and stats are fetched together so the tiles and the table always describe
 * the same moment. `forkJoin` fails as a unit, which is the honest outcome — a
 * page showing half the truth is worse than one showing an error.
 *
 * Reducers run before effects, so by the time `filterChanged` reaches here the
 * store already holds the new filter.
 */
export const loadOutbox$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(OutboxApiService)) =>
    actions$.pipe(
      ofType(OutboxActions.loadOutbox),
      withLatestFrom(store.select(selectFilter)),
      // switchMap: a newer load supersedes an in-flight one (matches Orders).
      switchMap(([, filter]) =>
        forkJoin({ messages: api.list(filter), stats: api.stats() }).pipe(
          map(({ messages, stats }) => OutboxActions.loadOutboxSuccess({ messages, stats })),
          catchError((error: unknown) =>
            of(OutboxActions.loadOutboxFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const reloadOnFilterChange$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(OutboxActions.filterChanged),
      map(() => OutboxActions.loadOutbox()),
    ),
  { functional: true },
);

export const lookupMessage$ = createEffect(
  (actions$ = inject(Actions), api = inject(OutboxApiService)) =>
    actions$.pipe(
      ofType(OutboxActions.lookupMessage),
      switchMap(({ id }) =>
        api.getById(id).pipe(
          map((message) => OutboxActions.lookupMessageSuccess({ message })),
          catchError((error: unknown) =>
            of(
              OutboxActions.lookupMessageFailure({
                error: toErrorMessage(error, `No outbox message found for id ${id}`),
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const markProcessed$ = createEffect(
  (actions$ = inject(Actions), api = inject(OutboxApiService)) =>
    actions$.pipe(
      ofType(OutboxActions.markProcessed),
      // mergeMap: per-row action, several rows may be actioned at once and must
      // neither queue behind nor cancel each other (same call as Orders' delete).
      mergeMap(({ id }) =>
        api.markProcessed(id).pipe(
          map((message) => OutboxActions.markProcessedSuccess({ message })),
          catchError((error: unknown) =>
            of(OutboxActions.markProcessedFailure({ id, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteMessage$ = createEffect(
  (actions$ = inject(Actions), api = inject(OutboxApiService)) =>
    actions$.pipe(
      ofType(OutboxActions.deleteMessage),
      mergeMap(({ id }) =>
        api.delete(id).pipe(
          map(() => OutboxActions.deleteMessageSuccess({ id })),
          catchError((error: unknown) =>
            of(OutboxActions.deleteMessageFailure({ id, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteAllMessages$ = createEffect(
  (actions$ = inject(Actions), api = inject(OutboxApiService)) =>
    actions$.pipe(
      ofType(OutboxActions.deleteAllMessages),
      // exhaustMap: ignore repeat clicks while the bulk delete runs.
      exhaustMap(() =>
        api.deleteAll().pipe(
          map(({ deletedCount }) => OutboxActions.deleteAllMessagesSuccess({ deletedCount })),
          catchError((error: unknown) =>
            of(OutboxActions.deleteAllMessagesFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

/**
 * Anything that changes the outbox changes `/stats` too, and the reducer cannot
 * recompute those counts locally — they cover every message, not just the rows
 * matching the current filter. So reload after a successful mutation.
 */
export const reloadAfterMutation$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        OutboxActions.markProcessedSuccess,
        OutboxActions.deleteMessageSuccess,
        OutboxActions.deleteAllMessagesSuccess,
      ),
      map(() => OutboxActions.loadOutbox()),
    ),
  { functional: true },
);

/**
 * The only place that knows updates can arrive on a timer — swap this for a
 * SignalR subscription later and nothing else changes. See `pollOrders$`.
 */
export const pollOutbox$ = createEffect(
  (actions$ = inject(Actions), config = inject(ApiConfigService)) =>
    actions$.pipe(
      ofType(OutboxActions.autoRefreshToggled),
      switchMap(({ enabled }) =>
        enabled
          ? timer(0, config.pollIntervalMs).pipe(map(() => OutboxActions.loadOutbox()))
          : EMPTY,
      ),
    ),
  { functional: true },
);

export const notifySuccess$ = createEffect(
  (actions$ = inject(Actions), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        OutboxActions.markProcessedSuccess,
        OutboxActions.deleteMessageSuccess,
        OutboxActions.deleteAllMessagesSuccess,
      ),
      tap((action) => {
        switch (action.type) {
          case OutboxActions.markProcessedSuccess.type:
            notifications.success('Message marked processed');
            break;
          case OutboxActions.deleteMessageSuccess.type:
            notifications.success('Message deleted');
            break;
          case OutboxActions.deleteAllMessagesSuccess.type:
            notifications.success(
              `Deleted ${action.deletedCount} message${action.deletedCount === 1 ? '' : 's'}`,
            );
            break;
        }
      }),
    ),
  { functional: true, dispatch: false },
);

/** `loadOutboxFailure` is excluded: it renders inline, and a failing poll would toast forever. */
export const notifyFailure$ = createEffect(
  (actions$ = inject(Actions), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        OutboxActions.markProcessedFailure,
        OutboxActions.deleteMessageFailure,
        OutboxActions.deleteAllMessagesFailure,
      ),
      tap(({ error }) => notifications.error(error)),
    ),
  { functional: true, dispatch: false },
);

/**
 * The push-based counterpart to pollOutbox$ above. `hub.connect()` is a no-op
 * if Orders' effect already connected - one shared connection, same as Orders.
 */
export const signalRPush$ = createEffect(
  (hub = inject(OrderStatusHubService)) => {
    hub.connect();
    return hub.outboxMessageChanged$.pipe(map((message) => OutboxActions.messagePushed({ message })));
  },
  { functional: true },
);
