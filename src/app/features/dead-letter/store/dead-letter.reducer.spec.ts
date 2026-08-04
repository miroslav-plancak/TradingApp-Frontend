import { DeadLetterCategory, DeadLetterLogResponse, DeadLetterStats } from '../../../core/models';
import { DeadLetterActions } from './dead-letter.actions';
import { deadLetterFeature } from './dead-letter.reducer';
import {
  selectAllEntries,
  selectCategoryCounts,
  selectIsEmpty,
  selectIsInitialLoading,
} from './dead-letter.selectors';

const { reducer, name } = deadLetterFeature;

function entry(overrides: Partial<DeadLetterLogResponse> = {}): DeadLetterLogResponse {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    clientOrderId: '22222222-2222-2222-2222-222222222222',
    reason: 'Validation failed',
    category: DeadLetterCategory.BusinessFailure,
    createdAt: '2026-08-04T10:00:00.0000000+00:00',
    isResolved: false,
    resolutionNotes: '',
    resolvedAt: null,
    resolvedBy: '',
    messageBody: '{"orderId":"abc"}',
    correlationId: 'corr-1',
    ...overrides,
  };
}

const stats: DeadLetterStats = {
  totalCount: 2,
  unresolvedCount: 1,
  resolvedCount: 1,
  last24Hours: 2,
};

const initialState = reducer(undefined, { type: '@@init' });

function withState(state: typeof initialState) {
  return { [name]: state };
}

function loaded(entries: DeadLetterLogResponse[], state = initialState) {
  return reducer(state, DeadLetterActions.loadDeadLettersSuccess({ entries, stats }));
}

describe('dead letter reducer', () => {
  it('starts unfiltered with no stats', () => {
    expect(initialState.filter).toBe('all');
    expect(initialState.stats).toBeNull();
  });

  it('stores entries and stats together, newest first', () => {
    const state = loaded([
      entry({ id: 'older', createdAt: '2026-08-04T09:00:00.0000000+00:00' }),
      entry({ id: 'newer', createdAt: '2026-08-04T11:00:00.0000000+00:00' }),
    ]);

    expect(selectAllEntries(withState(state)).map((e) => e.id)).toEqual(['newer', 'older']);
    expect(state.stats).toEqual(stats);
  });

  it('clears rows immediately when the filter changes', () => {
    const filtered = reducer(
      loaded([entry()]),
      DeadLetterActions.filterChanged({ filter: 'unresolved' }),
    );

    expect(filtered.filter).toBe('unresolved');
    expect(filtered.ids).toEqual([]);
    expect(filtered.loading).toBe(true);
  });

  it('updates an entry in place when resolved', () => {
    const resolving = reducer(
      loaded([entry({ id: 'a' })]),
      DeadLetterActions.resolveEntry({
        id: 'a',
        request: { resolutionNotes: 'fixed', resolvedBy: 'ops' },
      }),
    );
    expect(resolving.resolvingIds).toEqual(['a']);

    const resolved = reducer(
      resolving,
      DeadLetterActions.resolveEntrySuccess({
        entry: entry({ id: 'a', isResolved: true, resolvedAt: '2026-08-04T12:00:00Z' }),
      }),
    );

    expect(resolved.resolvingIds).toEqual([]);
    expect(resolved.entities['a']?.isResolved).toBe(true);
  });

  it('drops a resolved entry out of the unresolved view', () => {
    const filtered = reducer(
      initialState,
      DeadLetterActions.filterChanged({ filter: 'unresolved' }),
    );
    const withRow = loaded([entry({ id: 'a' })], filtered);

    const resolved = reducer(
      withRow,
      DeadLetterActions.resolveEntrySuccess({ entry: entry({ id: 'a', isResolved: true }) }),
    );

    expect(resolved.ids).toEqual([]);
  });

  it('keeps the lookup panel in step with resolve and delete', () => {
    const looked = reducer(
      loaded([entry({ id: 'a' })]),
      DeadLetterActions.lookupSuccess({ entry: entry({ id: 'a' }) }),
    );

    const resolved = reducer(
      looked,
      DeadLetterActions.resolveEntrySuccess({ entry: entry({ id: 'a', isResolved: true }) }),
    );
    expect(resolved.lookup.entry?.isResolved).toBe(true);

    const deleted = reducer(resolved, DeadLetterActions.deleteEntrySuccess({ id: 'a' }));
    expect(deleted.lookup.entry).toBeNull();
  });

  it('shares one lookup slot between the two lookup kinds', () => {
    const byId = reducer(initialState, DeadLetterActions.lookupById({ id: 'a' }));
    expect(byId.lookup.pending).toBe(true);

    const found = reducer(byId, DeadLetterActions.lookupSuccess({ entry: entry({ id: 'a' }) }));
    expect(found.lookup.entry?.id).toBe('a');

    // Starting a client-order lookup clears the previous result.
    const byClientOrder = reducer(
      found,
      DeadLetterActions.lookupByClientOrderId({ clientOrderId: 'c' }),
    );
    expect(byClientOrder.lookup.pending).toBe(true);
    expect(byClientOrder.lookup.entry).toBeNull();
  });

  it('adds an injected entry and clears the creating flag', () => {
    const creating = reducer(
      initialState,
      DeadLetterActions.createEntry({
        request: {
          clientOrderId: 'c',
          messageBody: '{}',
          reason: 'test',
          category: DeadLetterCategory.BusinessFailure,
          correlationId: 'corr',
        },
      }),
    );
    expect(creating.creating).toBe(true);

    const created = reducer(
      creating,
      DeadLetterActions.createEntrySuccess({ entry: entry({ id: 'new' }) }),
    );
    expect(created.creating).toBe(false);
    expect(created.entities['new']).toBeTruthy();
  });

  it('tracks per-entry deletes and empties everything on delete-all', () => {
    const deleting = reducer(
      loaded([entry({ id: 'a' }), entry({ id: 'b' })]),
      DeadLetterActions.deleteEntry({ id: 'a' }),
    );
    expect(deleting.deletingIds).toEqual(['a']);

    const deleted = reducer(deleting, DeadLetterActions.deleteEntrySuccess({ id: 'a' }));
    expect(deleted.ids).toEqual(['b']);

    const cleared = reducer(deleted, DeadLetterActions.deleteAllEntriesSuccess({ deletedCount: 1 }));
    expect(cleared.ids).toEqual([]);
  });
});

describe('dead letter selectors', () => {
  it('shows the spinner only before the first rows arrive', () => {
    const firstLoad = reducer(initialState, DeadLetterActions.loadDeadLetters());
    expect(selectIsInitialLoading(withState(firstLoad))).toBe(true);

    const polling = reducer(loaded([entry()]), DeadLetterActions.loadDeadLetters());
    expect(selectIsInitialLoading(withState(polling))).toBe(false);
  });

  it('is only "empty" after a successful load with no rows', () => {
    expect(selectIsEmpty(withState(initialState))).toBe(true);

    const failed = reducer(initialState, DeadLetterActions.loadDeadLettersFailure({ error: 'x' }));
    expect(selectIsEmpty(withState(failed))).toBe(false);
  });

  it('splits the loaded rows by failure category', () => {
    const state = loaded([
      entry({ id: 'a', category: DeadLetterCategory.BusinessFailure }),
      entry({ id: 'b', category: DeadLetterCategory.InfrastructureFailure }),
      entry({ id: 'c', category: DeadLetterCategory.InfrastructureFailure }),
    ]);

    expect(selectCategoryCounts(withState(state))).toEqual({
      [DeadLetterCategory.BusinessFailure]: 1,
      [DeadLetterCategory.InfrastructureFailure]: 2,
    });
  });
});
