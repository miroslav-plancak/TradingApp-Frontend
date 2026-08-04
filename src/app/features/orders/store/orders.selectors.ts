import { createSelector } from '@ngrx/store';

import { ORDER_STATUSES, OrderStatus } from '../../../core/models';
import { ordersAdapter, ordersFeature } from './orders.reducer';

const { selectAll, selectTotal } = ordersAdapter.getSelectors();

export const {
  selectOrdersState,
  selectLoading,
  selectError,
  selectLastLoadedAt,
  selectCreating,
  selectDeletingIds,
  selectAutoRefresh,
  selectLookup,
} = ordersFeature;

export const selectAllOrders = createSelector(selectOrdersState, selectAll);
export const selectOrderCount = createSelector(selectOrdersState, selectTotal);

/**
 * Only true for the very first load, so the polled refresh every few seconds
 * doesn't replace the table with a spinner.
 */
export const selectIsInitialLoading = createSelector(
  selectLoading,
  selectOrderCount,
  (loading, count) => loading && count === 0,
);

export const selectIsEmpty = createSelector(
  selectLoading,
  selectOrderCount,
  selectError,
  (loading, count, error) => !loading && !error && count === 0,
);

/** Count per status for the summary strip, always covering every known status. */
export const selectStatusCounts = createSelector(selectAllOrders, (orders) => {
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const order of orders) {
    // Guard against a status the backend adds before this app knows about it.
    counts[order.status] = (counts[order.status] ?? 0) + 1;
  }
  return counts;
});

export const selectProcessedCount = createSelector(
  selectAllOrders,
  (orders) => orders.filter((order) => order.isProcessed).length,
);
