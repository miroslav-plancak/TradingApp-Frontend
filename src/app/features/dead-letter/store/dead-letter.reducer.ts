import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';

import { DeadLetterLogResponse, DeadLetterStats } from '../../../core/models';
import { DeadLetterFilter } from '../dead-letter-api.service';
import { DeadLetterActions } from './dead-letter.actions';

export const DEAD_LETTER_FEATURE_KEY = 'deadLetter';

export interface DeadLetterState extends EntityState<DeadLetterLogResponse> {
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  filter: DeadLetterFilter;
  stats: DeadLetterStats | null;
  resolvingIds: string[];
  deletingIds: string[];
  creating: boolean;
  autoRefresh: boolean;
  lookup: {
    pending: boolean;
    entry: DeadLetterLogResponse | null;
    error: string | null;
  };
}

export const deadLetterAdapter = createEntityAdapter<DeadLetterLogResponse>({
  selectId: (entry) => entry.id,
  // Newest first; ISO 8601 sorts chronologically as a plain string.
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

const initialState: DeadLetterState = deadLetterAdapter.getInitialState({
  loading: false,
  error: null,
  lastLoadedAt: null,
  filter: 'all' as DeadLetterFilter,
  stats: null,
  resolvingIds: [],
  deletingIds: [],
  creating: false,
  autoRefresh: false,
  lookup: { pending: false, entry: null, error: null },
});

export const deadLetterFeature = createFeature({
  name: DEAD_LETTER_FEATURE_KEY,
  reducer: createReducer(
    initialState,

    on(DeadLetterActions.loadDeadLetters, (state) => ({ ...state, loading: true, error: null })),
    on(DeadLetterActions.loadDeadLettersSuccess, (state, { entries, stats }) =>
      deadLetterAdapter.setAll(entries, {
        ...state,
        loading: false,
        error: null,
        stats,
        lastLoadedAt: Date.now(),
      }),
    ),
    on(DeadLetterActions.loadDeadLettersFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    on(DeadLetterActions.filterChanged, (state, { filter }) =>
      deadLetterAdapter.removeAll({ ...state, filter, loading: true, error: null }),
    ),

    on(DeadLetterActions.resolveEntry, (state, { id }) => ({
      ...state,
      resolvingIds: [...state.resolvingIds, id],
    })),
    on(DeadLetterActions.resolveEntrySuccess, (state, { entry }) => {
      const cleared = {
        ...state,
        resolvingIds: state.resolvingIds.filter((resolvingId) => resolvingId !== entry.id),
        lookup: state.lookup.entry?.id === entry.id ? { ...state.lookup, entry } : state.lookup,
      };
      // A resolved entry no longer belongs in the unresolved view.
      return state.filter === 'unresolved'
        ? deadLetterAdapter.removeOne(entry.id, cleared)
        : deadLetterAdapter.upsertOne(entry, cleared);
    }),
    on(DeadLetterActions.resolveEntryFailure, (state, { id }) => ({
      ...state,
      resolvingIds: state.resolvingIds.filter((resolvingId) => resolvingId !== id),
    })),

    on(DeadLetterActions.createEntry, (state) => ({ ...state, creating: true })),
    on(DeadLetterActions.createEntrySuccess, (state, { entry }) =>
      deadLetterAdapter.upsertOne(entry, { ...state, creating: false }),
    ),
    on(DeadLetterActions.createEntryFailure, (state) => ({ ...state, creating: false })),

    on(DeadLetterActions.deleteEntry, (state, { id }) => ({
      ...state,
      deletingIds: [...state.deletingIds, id],
    })),
    on(DeadLetterActions.deleteEntrySuccess, (state, { id }) =>
      deadLetterAdapter.removeOne(id, {
        ...state,
        deletingIds: state.deletingIds.filter((deletingId) => deletingId !== id),
        lookup: state.lookup.entry?.id === id ? { ...state.lookup, entry: null } : state.lookup,
      }),
    ),
    on(DeadLetterActions.deleteEntryFailure, (state, { id }) => ({
      ...state,
      deletingIds: state.deletingIds.filter((deletingId) => deletingId !== id),
    })),

    on(DeadLetterActions.deleteAllEntriesSuccess, (state) =>
      deadLetterAdapter.removeAll({
        ...state,
        deletingIds: [],
        resolvingIds: [],
        lookup: { pending: false, entry: null, error: null },
      }),
    ),

    // Both lookups share one slot: only one result is ever on screen.
    on(DeadLetterActions.lookupById, DeadLetterActions.lookupByClientOrderId, (state) => ({
      ...state,
      lookup: { pending: true, entry: null, error: null },
    })),
    on(DeadLetterActions.lookupSuccess, (state, { entry }) => ({
      ...state,
      lookup: { pending: false, entry, error: null },
    })),
    on(DeadLetterActions.lookupFailure, (state, { error }) => ({
      ...state,
      lookup: { pending: false, entry: null, error },
    })),
    on(DeadLetterActions.clearLookup, (state) => ({
      ...state,
      lookup: { pending: false, entry: null, error: null },
    })),

    on(DeadLetterActions.autoRefreshToggled, (state, { enabled }) => ({
      ...state,
      autoRefresh: enabled,
    })),

    // A push is always a freshly-created, unresolved entry - it belongs under
    // every filter, so no removeOne branch is needed (unlike resolveEntrySuccess).
    on(DeadLetterActions.entryPushed, (state, { entry }) =>
      deadLetterAdapter.upsertOne(entry, {
        ...state,
        lookup: state.lookup.entry?.id === entry.id ? { ...state.lookup, entry } : state.lookup,
      }),
    ),
  ),
});
