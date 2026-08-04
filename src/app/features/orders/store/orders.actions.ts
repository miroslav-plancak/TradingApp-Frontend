import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { CreateOrderRequest, CreatedOrderResponse, OrderResponse } from '../../../core/models';

/**
 * `loadOrders` is dispatched by three different triggers — the page opening, the
 * manual refresh button, and the auto-refresh timer. Nothing downstream can tell
 * them apart, which is the property that lets SignalR replace the timer later
 * without touching the reducer, the selectors, or any component.
 */
export const OrdersActions = createActionGroup({
  source: 'Orders',
  events: {
    'Load Orders': emptyProps(),
    'Load Orders Success': props<{ orders: OrderResponse[] }>(),
    'Load Orders Failure': props<{ error: string }>(),

    'Create Order': props<{ request: CreateOrderRequest }>(),
    'Create Order Success': props<{ order: CreatedOrderResponse }>(),
    'Create Order Failure': props<{ error: string }>(),

    'Lookup Order': props<{ orderId: string }>(),
    'Lookup Order Success': props<{ order: OrderResponse }>(),
    'Lookup Order Failure': props<{ error: string }>(),
    'Clear Lookup': emptyProps(),

    'Delete Order': props<{ orderId: string }>(),
    'Delete Order Success': props<{ orderId: string }>(),
    'Delete Order Failure': props<{ orderId: string; error: string }>(),

    'Delete All Orders': emptyProps(),
    'Delete All Orders Success': props<{ deletedCount: number }>(),
    'Delete All Orders Failure': props<{ error: string }>(),

    /** The "Auto 5s" toggle. The only action that knows polling exists. */
    'Auto Refresh Toggled': props<{ enabled: boolean }>(),
  },
});
