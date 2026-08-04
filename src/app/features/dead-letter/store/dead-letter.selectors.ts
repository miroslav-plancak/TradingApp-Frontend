import { createSelector } from '@ngrx/store';

import { DeadLetterCategory } from '../../../core/models';
import { deadLetterAdapter, deadLetterFeature } from './dead-letter.reducer';

const { selectAll, selectTotal } = deadLetterAdapter.getSelectors();

export const {
  selectDeadLetterState,
  selectLoading,
  selectError,
  selectLastLoadedAt,
  selectFilter,
  selectStats,
  selectResolvingIds,
  selectDeletingIds,
  selectCreating,
  selectAutoRefresh,
  selectLookup,
} = deadLetterFeature;

export const selectAllEntries = createSelector(selectDeadLetterState, selectAll);
export const selectEntryCount = createSelector(selectDeadLetterState, selectTotal);

export const selectIsInitialLoading = createSelector(
  selectLoading,
  selectEntryCount,
  (loading, count) => loading && count === 0,
);

export const selectIsEmpty = createSelector(
  selectLoading,
  selectEntryCount,
  selectError,
  (loading, count, error) => !loading && !error && count === 0,
);

/**
 * Split of the loaded rows by failure category.
 *
 * Business failures are a data problem — the message will never succeed as-is.
 * Infrastructure failures are usually transient and worth retrying upstream, so
 * the distinction drives what an operator does next.
 */
export const selectCategoryCounts = createSelector(selectAllEntries, (entries) => ({
  [DeadLetterCategory.BusinessFailure]: entries.filter(
    (entry) => entry.category === DeadLetterCategory.BusinessFailure,
  ).length,
  [DeadLetterCategory.InfrastructureFailure]: entries.filter(
    (entry) => entry.category === DeadLetterCategory.InfrastructureFailure,
  ).length,
}));
