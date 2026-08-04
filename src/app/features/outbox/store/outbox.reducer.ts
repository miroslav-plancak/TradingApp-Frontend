import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';

import { OutboxMessageResponse, OutboxMessageStats } from '../../../core/models';
import { OutboxFilter } from '../outbox-api.service';
import { OutboxActions } from './outbox.actions';

export const OUTBOX_FEATURE_KEY = 'outbox';

export interface OutboxState extends EntityState<OutboxMessageResponse> {
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  filter: OutboxFilter;
  /** From `/stats`, so it counts every message — not just the filtered page. */
  stats: OutboxMessageStats | null;
  /** Ids with a mark-processed in flight. */
  markingIds: string[];
  deletingIds: string[];
  autoRefresh: boolean;
  lookup: {
    pending: boolean;
    message: OutboxMessageResponse | null;
    error: string | null;
  };
}

export const outboxAdapter = createEntityAdapter<OutboxMessageResponse>({
  selectId: (message) => message.id,
  // Newest first; ISO 8601 sorts chronologically as a plain string.
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

const initialState: OutboxState = outboxAdapter.getInitialState({
  loading: false,
  error: null,
  lastLoadedAt: null,
  filter: 'all' as OutboxFilter,
  stats: null,
  markingIds: [],
  deletingIds: [],
  autoRefresh: false,
  lookup: { pending: false, message: null, error: null },
});

/** Keep the lookup panel in step when the same message changes elsewhere. */
function syncLookup(
  lookup: OutboxState['lookup'],
  message: OutboxMessageResponse,
): OutboxState['lookup'] {
  return lookup.message?.id === message.id ? { ...lookup, message } : lookup;
}

export const outboxFeature = createFeature({
  name: OUTBOX_FEATURE_KEY,
  reducer: createReducer(
    initialState,

    on(OutboxActions.loadOutbox, (state) => ({ ...state, loading: true, error: null })),
    on(OutboxActions.loadOutboxSuccess, (state, { messages, stats }) =>
      outboxAdapter.setAll(messages, {
        ...state,
        loading: false,
        error: null,
        stats,
        lastLoadedAt: Date.now(),
      }),
    ),
    on(OutboxActions.loadOutboxFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),

    // Clear the rows immediately so the table can't briefly show the old
    // filter's messages under the new filter's heading.
    on(OutboxActions.filterChanged, (state, { filter }) =>
      outboxAdapter.removeAll({ ...state, filter, loading: true, error: null }),
    ),

    on(OutboxActions.markProcessed, (state, { id }) => ({
      ...state,
      markingIds: [...state.markingIds, id],
    })),
    on(OutboxActions.markProcessedSuccess, (state, { message }) => {
      const cleared = {
        ...state,
        markingIds: state.markingIds.filter((markingId) => markingId !== message.id),
        lookup: syncLookup(state.lookup, message),
      };
      // A message that no longer matches the active filter drops out of view.
      return state.filter === 'unprocessed'
        ? outboxAdapter.removeOne(message.id, cleared)
        : outboxAdapter.upsertOne(message, cleared);
    }),
    on(OutboxActions.markProcessedFailure, (state, { id }) => ({
      ...state,
      markingIds: state.markingIds.filter((markingId) => markingId !== id),
    })),

    on(OutboxActions.deleteMessage, (state, { id }) => ({
      ...state,
      deletingIds: [...state.deletingIds, id],
    })),
    on(OutboxActions.deleteMessageSuccess, (state, { id }) =>
      outboxAdapter.removeOne(id, {
        ...state,
        deletingIds: state.deletingIds.filter((deletingId) => deletingId !== id),
        lookup: state.lookup.message?.id === id ? { ...state.lookup, message: null } : state.lookup,
      }),
    ),
    on(OutboxActions.deleteMessageFailure, (state, { id }) => ({
      ...state,
      deletingIds: state.deletingIds.filter((deletingId) => deletingId !== id),
    })),

    on(OutboxActions.deleteAllMessagesSuccess, (state) =>
      outboxAdapter.removeAll({
        ...state,
        deletingIds: [],
        markingIds: [],
        lookup: { pending: false, message: null, error: null },
      }),
    ),

    on(OutboxActions.lookupMessage, (state) => ({
      ...state,
      lookup: { pending: true, message: null, error: null },
    })),
    on(OutboxActions.lookupMessageSuccess, (state, { message }) => ({
      ...state,
      lookup: { pending: false, message, error: null },
    })),
    on(OutboxActions.lookupMessageFailure, (state, { error }) => ({
      ...state,
      lookup: { pending: false, message: null, error },
    })),
    on(OutboxActions.clearLookup, (state) => ({
      ...state,
      lookup: { pending: false, message: null, error: null },
    })),

    on(OutboxActions.autoRefreshToggled, (state, { enabled }) => ({
      ...state,
      autoRefresh: enabled,
    })),
  ),
});
