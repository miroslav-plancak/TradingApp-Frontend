import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { Orders } from './orders';
import * as ordersEffects from './store/orders.effects';
import { ordersFeature } from './store/orders.reducer';

export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    component: Orders,
    title: 'Orders · TradingApp Ops',
    // State and effects arrive with the lazy chunk on first navigation here.
    // They are NOT torn down when the route is left (verified in the browser),
    // and re-entering does not register them twice. Anything with a lifetime —
    // the auto-refresh timer — must therefore be stopped by the component
    // itself; see `Orders.ngOnDestroy`.
    providers: [provideState(ordersFeature), provideEffects(ordersEffects)],
  },
];
