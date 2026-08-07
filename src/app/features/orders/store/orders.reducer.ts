import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';

import { OrderResponse } from '../../../core/models';
import { OrdersActions } from './orders.actions';

export const ORDERS_FEATURE_KEY = 'orders';

export interface OrdersState extends EntityState<OrderResponse> {
  /** True while a list request is in flight — including polled ones. */
  loading: boolean;
  /** Last list-level failure, shown inline; per-action failures go to the snackbar. */
  error: string | null;
  /** When the list was last successfully refreshed (epoch ms), for "updated Xs ago". */
  lastLoadedAt: number | null;
  creating: boolean;
  /** Ids with a delete in flight, so individual rows can show a spinner. */
  deletingIds: string[];
  autoRefresh: boolean;
  lookup: {
    pending: boolean;
    order: OrderResponse | null;
    error: string | null;
  };
}

export const ordersAdapter = createEntityAdapter<OrderResponse>({
  selectId: (order) => order.id,
  // Newest first. `createdAt` is an ISO 8601 string, so lexicographic ordering
  // is chronological ordering — no Date parsing needed on every comparison.
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

const initialState: OrdersState = ordersAdapter.getInitialState({
  loading: false,
  error: null,
  lastLoadedAt: null,
  creating: false,
  deletingIds: [],
  autoRefresh: false,
  lookup: { pending: false, order: null, error: null },
});

export const ordersFeature = createFeature({
  name: ORDERS_FEATURE_KEY,
  reducer: createReducer(
    initialState,

    on(OrdersActions.loadOrders, (state) => ({ ...state, loading: true, error: null })),
    on(OrdersActions.loadOrdersSuccess, (state, { orders }) =>
      ordersAdapter.setAll(orders, {
        ...state,
        loading: false,
        error: null,
        lastLoadedAt: Date.now(),
      }),
    ),
    on(OrdersActions.loadOrdersFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    on(OrdersActions.createOrder, (state) => ({ ...state, creating: true })),
    // Show the new order immediately; the reload that follows reconciles it with
    // whatever the server actually stored.
    on(OrdersActions.createOrderSuccess, (state, { order }) =>
      ordersAdapter.upsertOne(order, { ...state, creating: false }),
    ),
    on(OrdersActions.createOrderFailure, (state) => ({ ...state, creating: false })),

    on(OrdersActions.deleteOrder, (state, { orderId }) => ({
      ...state,
      deletingIds: [...state.deletingIds, orderId],
    })),
    on(OrdersActions.deleteOrderSuccess, (state, { orderId }) =>
      ordersAdapter.removeOne(orderId, {
        ...state,
        deletingIds: state.deletingIds.filter((id) => id !== orderId),
        // Drop the lookup result too if it was the row just deleted.
        lookup: state.lookup.order?.id === orderId ? { ...state.lookup, order: null } : state.lookup,
      }),
    ),
    on(OrdersActions.deleteOrderFailure, (state, { orderId }) => ({
      ...state,
      deletingIds: state.deletingIds.filter((id) => id !== orderId),
    })),

    on(OrdersActions.deleteAllOrdersSuccess, (state) =>
      ordersAdapter.removeAll({
        ...state,
        deletingIds: [],
        lookup: { pending: false, order: null, error: null },
      }),
    ),

    on(OrdersActions.lookupOrder, (state) => ({
      ...state,
      lookup: { pending: true, order: null, error: null },
    })),
    on(OrdersActions.lookupOrderSuccess, (state, { order }) => ({
      ...state,
      lookup: { pending: false, order, error: null },
    })),
    on(OrdersActions.lookupOrderFailure, (state, { error }) => ({
      ...state,
      lookup: { pending: false, order: null, error },
    })),
    on(OrdersActions.clearLookup, (state) => ({
      ...state,
      lookup: { pending: false, order: null, error: null },
    })),

    on(OrdersActions.autoRefreshToggled, (state, { enabled }) => ({
      ...state,
      autoRefresh: enabled,
    })),

    on(OrdersActions.orderStatusPushed, (state, { order }) => ordersAdapter.upsertOne(order, state)),
  ),
});
