import { createSelector } from '@ngrx/store';

import { outboxAdapter, outboxFeature } from './outbox.reducer';

const { selectAll, selectTotal } = outboxAdapter.getSelectors();

export const {
  selectOutboxState,
  selectLoading,
  selectError,
  selectLastLoadedAt,
  selectFilter,
  selectStats,
  selectMarkingIds,
  selectDeletingIds,
  selectAutoRefresh,
  selectLookup,
} = outboxFeature;

export const selectAllMessages = createSelector(selectOutboxState, selectAll);
export const selectMessageCount = createSelector(selectOutboxState, selectTotal);

/** Spinner only on the first load, so a poll never blanks the table. */
export const selectIsInitialLoading = createSelector(
  selectLoading,
  selectMessageCount,
  (loading, count) => loading && count === 0,
);

export const selectIsEmpty = createSelector(
  selectLoading,
  selectMessageCount,
  selectError,
  (loading, count, error) => !loading && !error && count === 0,
);

/**
 * Messages the outbox processor has retried at least once — the ones actually
 * worth an operator's attention.
 */
export const selectRetryingCount = createSelector(
  selectAllMessages,
  (messages) => messages.filter((message) => message.retryCount > 0).length,
);

/**
 * `RetryCount >= 5` is the threshold at which `ScheduledOutboxMessageProcessor`
 * quarantines a message, so anything at or past it is already stuck.
 */
export const QUARANTINE_RETRY_THRESHOLD = 5;

export const selectStuckCount = createSelector(
  selectAllMessages,
  (messages) =>
    messages.filter((message) => message.retryCount >= QUARANTINE_RETRY_THRESHOLD).length,
);
