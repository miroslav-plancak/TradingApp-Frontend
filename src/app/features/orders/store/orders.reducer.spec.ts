import { CreatedOrderResponse, OrderResponse } from '../../../core/models';
import { OrdersActions } from './orders.actions';
import { ordersFeature } from './orders.reducer';
import {
  selectAllOrders,
  selectIsEmpty,
  selectIsInitialLoading,
  selectStatusCounts,
} from './orders.selectors';

const { reducer, name } = ordersFeature;

function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    clientOrderId: '22222222-2222-2222-2222-222222222222',
    status: 'PENDING_ACK',
    quantity: 10,
    price: 1.5,
    createdAt: '2026-08-04T10:00:00.0000000+00:00',
    updatedAt: '2026-08-04T10:00:00.0000000+00:00',
    isProcessed: false,
    ...overrides,
  };
}

const initialState = reducer(undefined, { type: '@@init' });

/** Selectors are written against the root state, so wrap the slice. */
function withState(state: typeof initialState) {
  return { [name]: state };
}

describe('orders reducer', () => {
  it('starts empty and not loading', () => {
    expect(initialState.ids).toEqual([]);
    expect(initialState.loading).toBe(false);
    expect(initialState.autoRefresh).toBe(false);
  });

  it('replaces the whole list on load success', () => {
    const loaded = reducer(
      reducer(initialState, OrdersActions.loadOrders()),
      OrdersActions.loadOrdersSuccess({ orders: [order(), order({ id: 'a' })] }),
    );
    expect(loaded.ids.length).toBe(2);

    const reloaded = reducer(loaded, OrdersActions.loadOrdersSuccess({ orders: [order()] }));
    expect(reloaded.ids.length).toBe(1);
    expect(reloaded.loading).toBe(false);
    expect(reloaded.lastLoadedAt).not.toBeNull();
  });

  it('sorts newest first regardless of arrival order', () => {
    const state = reducer(
      initialState,
      OrdersActions.loadOrdersSuccess({
        orders: [
          order({ id: 'older', createdAt: '2026-08-04T09:00:00.0000000+00:00' }),
          order({ id: 'newer', createdAt: '2026-08-04T11:00:00.0000000+00:00' }),
        ],
      }),
    );

    expect(selectAllOrders(withState(state)).map((o) => o.id)).toEqual(['newer', 'older']);
  });

  it('keeps a failed load visible without wiping the existing rows', () => {
    const loaded = reducer(initialState, OrdersActions.loadOrdersSuccess({ orders: [order()] }));
    const failed = reducer(loaded, OrdersActions.loadOrdersFailure({ error: 'boom' }));

    expect(failed.error).toBe('boom');
    expect(failed.loading).toBe(false);
    expect(failed.ids.length).toBe(1);
  });

  it('adds a created order immediately', () => {
    const created: CreatedOrderResponse = {
      ...order({ id: 'created' }),
      correlationId: 'corr-1',
    };
    const state = reducer(
      reducer(initialState, OrdersActions.createOrder({ request: { quantity: 1, price: 1 } })),
      OrdersActions.createOrderSuccess({ order: created }),
    );

    expect(state.creating).toBe(false);
    expect(state.entities['created']).toBeTruthy();
  });

  it('tracks in-flight deletes per row and clears them on both outcomes', () => {
    const loaded = reducer(
      initialState,
      OrdersActions.loadOrdersSuccess({ orders: [order({ id: 'a' }), order({ id: 'b' })] }),
    );

    const deleting = reducer(loaded, OrdersActions.deleteOrder({ orderId: 'a' }));
    expect(deleting.deletingIds).toEqual(['a']);

    const deleted = reducer(deleting, OrdersActions.deleteOrderSuccess({ orderId: 'a' }));
    expect(deleted.deletingIds).toEqual([]);
    expect(deleted.ids).toEqual(['b']);

    const failed = reducer(
      reducer(deleted, OrdersActions.deleteOrder({ orderId: 'b' })),
      OrdersActions.deleteOrderFailure({ orderId: 'b', error: 'nope' }),
    );
    expect(failed.deletingIds).toEqual([]);
    expect(failed.ids).toEqual(['b']);
  });

  it('clears the lookup result when that order is deleted', () => {
    const looked = reducer(
      initialState,
      OrdersActions.lookupOrderSuccess({ order: order({ id: 'a' }) }),
    );
    expect(looked.lookup.order?.id).toBe('a');

    const deleted = reducer(looked, OrdersActions.deleteOrderSuccess({ orderId: 'a' }));
    expect(deleted.lookup.order).toBeNull();
  });

  it('empties everything on delete-all', () => {
    const loaded = reducer(initialState, OrdersActions.loadOrdersSuccess({ orders: [order()] }));
    const cleared = reducer(loaded, OrdersActions.deleteAllOrdersSuccess({ deletedCount: 1 }));

    expect(cleared.ids).toEqual([]);
  });

  it('records the auto-refresh toggle', () => {
    const on = reducer(initialState, OrdersActions.autoRefreshToggled({ enabled: true }));
    expect(on.autoRefresh).toBe(true);
    expect(reducer(on, OrdersActions.autoRefreshToggled({ enabled: false })).autoRefresh).toBe(
      false,
    );
  });
});

describe('orders selectors', () => {
  it('reports initial loading only while the list is still empty', () => {
    const firstLoad = reducer(initialState, OrdersActions.loadOrders());
    expect(selectIsInitialLoading(withState(firstLoad))).toBe(true);

    // A poll refreshing an already-populated list must not blank out the table.
    const loaded = reducer(firstLoad, OrdersActions.loadOrdersSuccess({ orders: [order()] }));
    const polling = reducer(loaded, OrdersActions.loadOrders());
    expect(selectIsInitialLoading(withState(polling))).toBe(false);
  });

  it('is only "empty" when a load actually succeeded with no rows', () => {
    expect(selectIsEmpty(withState(initialState))).toBe(true);
    expect(selectIsEmpty(withState(reducer(initialState, OrdersActions.loadOrders())))).toBe(false);

    const failed = reducer(initialState, OrdersActions.loadOrdersFailure({ error: 'boom' }));
    expect(selectIsEmpty(withState(failed))).toBe(false);
  });

  it('counts every known status, including the ones with no orders', () => {
    const state = reducer(
      initialState,
      OrdersActions.loadOrdersSuccess({
        orders: [
          order({ id: 'a', status: 'FILLED' }),
          order({ id: 'b', status: 'FILLED' }),
          order({ id: 'c', status: 'REJECTED' }),
        ],
      }),
    );

    expect(selectStatusCounts(withState(state))).toEqual({
      PENDING_ACK: 0,
      ACKNOWLEDGED: 0,
      REJECTED: 1,
      FILLED: 2,
    });
  });
});
