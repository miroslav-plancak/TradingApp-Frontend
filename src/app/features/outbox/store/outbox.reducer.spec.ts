import { OutboxMessageResponse, OutboxMessageStats } from '../../../core/models';
import { OutboxActions } from './outbox.actions';
import { outboxFeature } from './outbox.reducer';
import {
  selectAllMessages,
  selectIsEmpty,
  selectIsInitialLoading,
  selectStuckCount,
} from './outbox.selectors';

const { reducer, name } = outboxFeature;

function message(overrides: Partial<OutboxMessageResponse> = {}): OutboxMessageResponse {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'OrderCreatedIntegrationEvent',
    payload: '{"orderId":"abc"}',
    createdAt: '2026-08-04T10:00:00.0000000+00:00',
    processedAt: null,
    retryCount: 0,
    isProcessed: false,
    ...overrides,
  };
}

const stats: OutboxMessageStats = {
  totalCount: 3,
  processedCount: 1,
  unprocessedCount: 2,
  last24Hours: 3,
};

const initialState = reducer(undefined, { type: '@@init' });

function withState(state: typeof initialState) {
  return { [name]: state };
}

function loaded(messages: OutboxMessageResponse[], state = initialState) {
  return reducer(state, OutboxActions.loadOutboxSuccess({ messages, stats }));
}

describe('outbox reducer', () => {
  it('starts on the unfiltered list with no stats', () => {
    expect(initialState.filter).toBe('all');
    expect(initialState.stats).toBeNull();
    expect(initialState.autoRefresh).toBe(false);
  });

  it('stores list and stats together', () => {
    const state = loaded([message()]);

    expect(state.ids.length).toBe(1);
    expect(state.stats).toEqual(stats);
    expect(state.loading).toBe(false);
    expect(state.lastLoadedAt).not.toBeNull();
  });

  it('sorts newest first', () => {
    const state = loaded([
      message({ id: 'older', createdAt: '2026-08-04T09:00:00.0000000+00:00' }),
      message({ id: 'newer', createdAt: '2026-08-04T11:00:00.0000000+00:00' }),
    ]);

    expect(selectAllMessages(withState(state)).map((m) => m.id)).toEqual(['newer', 'older']);
  });

  it('keeps rows when a load fails', () => {
    const failed = reducer(
      loaded([message()]),
      OutboxActions.loadOutboxFailure({ error: 'boom' }),
    );

    expect(failed.error).toBe('boom');
    expect(failed.ids.length).toBe(1);
  });

  it('clears rows immediately when the filter changes', () => {
    const filtered = reducer(
      loaded([message()]),
      OutboxActions.filterChanged({ filter: 'unprocessed' }),
    );

    // Otherwise the old filter's rows would sit under the new filter's heading
    // until the request comes back.
    expect(filtered.filter).toBe('unprocessed');
    expect(filtered.ids).toEqual([]);
    expect(filtered.loading).toBe(true);
  });

  it('updates a message in place when marked processed', () => {
    const state = reducer(
      reducer(loaded([message({ id: 'a' })]), OutboxActions.markProcessed({ id: 'a' })),
      OutboxActions.markProcessedSuccess({
        message: message({ id: 'a', isProcessed: true, processedAt: '2026-08-04T12:00:00Z' }),
      }),
    );

    expect(state.markingIds).toEqual([]);
    expect(state.entities['a']?.isProcessed).toBe(true);
  });

  it('drops a message that no longer matches the unprocessed filter', () => {
    const filtered = reducer(
      loaded([message({ id: 'a' })]),
      OutboxActions.filterChanged({ filter: 'unprocessed' }),
    );
    const withRow = loaded([message({ id: 'a' })], filtered);

    const marked = reducer(
      withRow,
      OutboxActions.markProcessedSuccess({ message: message({ id: 'a', isProcessed: true }) }),
    );

    expect(marked.ids).toEqual([]);
  });

  it('clears the marking flag when marking fails', () => {
    const marking = reducer(loaded([message({ id: 'a' })]), OutboxActions.markProcessed({ id: 'a' }));
    const failed = reducer(
      marking,
      OutboxActions.markProcessedFailure({ id: 'a', error: 'nope' }),
    );

    expect(failed.markingIds).toEqual([]);
    expect(failed.ids).toEqual(['a']);
  });

  it('keeps the lookup panel in step with a mark-processed on the same message', () => {
    const looked = reducer(
      loaded([message({ id: 'a' })]),
      OutboxActions.lookupMessageSuccess({ message: message({ id: 'a' }) }),
    );

    const marked = reducer(
      looked,
      OutboxActions.markProcessedSuccess({ message: message({ id: 'a', isProcessed: true }) }),
    );
    expect(marked.lookup.message?.isProcessed).toBe(true);

    const deleted = reducer(marked, OutboxActions.deleteMessageSuccess({ id: 'a' }));
    expect(deleted.lookup.message).toBeNull();
  });

  it('tracks per-row deletes and empties everything on delete-all', () => {
    const deleting = reducer(
      loaded([message({ id: 'a' }), message({ id: 'b' })]),
      OutboxActions.deleteMessage({ id: 'a' }),
    );
    expect(deleting.deletingIds).toEqual(['a']);

    const deleted = reducer(deleting, OutboxActions.deleteMessageSuccess({ id: 'a' }));
    expect(deleted.ids).toEqual(['b']);
    expect(deleted.deletingIds).toEqual([]);

    const cleared = reducer(deleted, OutboxActions.deleteAllMessagesSuccess({ deletedCount: 1 }));
    expect(cleared.ids).toEqual([]);
  });
});

describe('outbox selectors', () => {
  it('shows the spinner only before the first rows arrive', () => {
    const firstLoad = reducer(initialState, OutboxActions.loadOutbox());
    expect(selectIsInitialLoading(withState(firstLoad))).toBe(true);

    const polling = reducer(loaded([message()]), OutboxActions.loadOutbox());
    expect(selectIsInitialLoading(withState(polling))).toBe(false);
  });

  it('is only "empty" after a successful load with no rows', () => {
    expect(selectIsEmpty(withState(initialState))).toBe(true);
    expect(selectIsEmpty(withState(reducer(initialState, OutboxActions.loadOutbox())))).toBe(false);
  });

  it('counts messages at or past the quarantine threshold', () => {
    const state = loaded([
      message({ id: 'a', retryCount: 0 }),
      message({ id: 'b', retryCount: 4 }),
      message({ id: 'c', retryCount: 5 }),
      message({ id: 'd', retryCount: 9 }),
    ]);

    expect(selectStuckCount(withState(state))).toBe(2);
  });
});
