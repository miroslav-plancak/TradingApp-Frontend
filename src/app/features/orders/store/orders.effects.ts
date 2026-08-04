import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, exhaustMap, map, mergeMap, of, switchMap, tap, timer } from 'rxjs';

import { ApiConfigService } from '../../../core/config/api-config.service';
import { toErrorMessage } from '../../../core/api/http-error';
import { NotificationService } from '../../../core/notifications/notification.service';
import { OrdersApiService } from '../orders-api.service';
import { OrdersActions } from './orders.actions';

export const loadOrders$ = createEffect(
  (actions$ = inject(Actions), api = inject(OrdersApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.loadOrders),
      // switchMap, not concatMap: a newer list request always supersedes an
      // in-flight one, which matters when polling overlaps a manual refresh.
      switchMap(() =>
        api.list().pipe(
          map((orders) => OrdersActions.loadOrdersSuccess({ orders })),
          catchError((error: unknown) =>
            of(OrdersActions.loadOrdersFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const createOrder$ = createEffect(
  (actions$ = inject(Actions), api = inject(OrdersApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.createOrder),
      // exhaustMap: ignore repeat submits while one is still in flight.
      exhaustMap(({ request }) =>
        api.create(request).pipe(
          map((order) => OrdersActions.createOrderSuccess({ order })),
          catchError((error: unknown) =>
            of(OrdersActions.createOrderFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

/** A new order enters the pipeline asynchronously — reload to pick up its real state. */
export const reloadAfterCreate$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(OrdersActions.createOrderSuccess),
      map(() => OrdersActions.loadOrders()),
    ),
  { functional: true },
);

export const lookupOrder$ = createEffect(
  (actions$ = inject(Actions), api = inject(OrdersApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.lookupOrder),
      switchMap(({ orderId }) =>
        api.getById(orderId).pipe(
          map((order) => OrdersActions.lookupOrderSuccess({ order })),
          catchError((error: unknown) =>
            of(
              OrdersActions.lookupOrderFailure({
                error: toErrorMessage(error, `No order found for id ${orderId}`),
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteOrder$ = createEffect(
  (actions$ = inject(Actions), api = inject(OrdersApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.deleteOrder),
      // mergeMap: deleting several rows at once should not serialize or cancel.
      mergeMap(({ orderId }) =>
        api.delete(orderId).pipe(
          map(() => OrdersActions.deleteOrderSuccess({ orderId })),
          catchError((error: unknown) =>
            of(OrdersActions.deleteOrderFailure({ orderId, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteAllOrders$ = createEffect(
  (actions$ = inject(Actions), api = inject(OrdersApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.deleteAllOrders),
      exhaustMap(() =>
        api.deleteAll().pipe(
          map(({ deletedCount }) => OrdersActions.deleteAllOrdersSuccess({ deletedCount })),
          catchError((error: unknown) =>
            of(OrdersActions.deleteAllOrdersFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

/**
 * The one and only place that knows updates can arrive on a timer.
 *
 * It dispatches exactly the action the manual refresh button dispatches, so
 * swapping this trigger for a SignalR hub push later touches this effect and
 * nothing else — no reducer, selector, or component is aware of polling.
 */
export const pollOrders$ = createEffect(
  (actions$ = inject(Actions), config = inject(ApiConfigService)) =>
    actions$.pipe(
      ofType(OrdersActions.autoRefreshToggled),
      // switchMap cancels the previous timer, so toggling off simply stops it.
      switchMap(({ enabled }) =>
        enabled
          ? timer(0, config.pollIntervalMs).pipe(map(() => OrdersActions.loadOrders()))
          : EMPTY,
      ),
    ),
  { functional: true },
);

export const notifySuccess$ = createEffect(
  (actions$ = inject(Actions), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        OrdersActions.createOrderSuccess,
        OrdersActions.deleteOrderSuccess,
        OrdersActions.deleteAllOrdersSuccess,
      ),
      tap((action) => {
        switch (action.type) {
          case OrdersActions.createOrderSuccess.type:
            notifications.success(`Order created — client order id ${action.order.clientOrderId}`);
            break;
          case OrdersActions.deleteOrderSuccess.type:
            notifications.success('Order deleted');
            break;
          case OrdersActions.deleteAllOrdersSuccess.type:
            notifications.success(
              `Deleted ${action.deletedCount} order${action.deletedCount === 1 ? '' : 's'}`,
            );
            break;
        }
      }),
    ),
  { functional: true, dispatch: false },
);

/**
 * Failures that have nowhere on-screen to live get a snackbar. `loadOrdersFailure`
 * is excluded on purpose: it renders inline above the table, and a poll failing
 * every few seconds would otherwise bury the screen in toasts.
 */
export const notifyFailure$ = createEffect(
  (actions$ = inject(Actions), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        OrdersActions.createOrderFailure,
        OrdersActions.deleteOrderFailure,
        OrdersActions.deleteAllOrdersFailure,
      ),
      tap(({ error }) => notifications.error(error)),
    ),
  { functional: true, dispatch: false },
);
