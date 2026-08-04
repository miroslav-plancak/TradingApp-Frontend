import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { Outbox } from './outbox';
import * as outboxEffects from './store/outbox.effects';
import { outboxFeature } from './store/outbox.reducer';

export const OUTBOX_ROUTES: Routes = [
  {
    path: '',
    component: Outbox,
    title: 'Outbox · TradingApp Ops',
    // As in Orders: these arrive with the lazy chunk and are NOT torn down when
    // the route is left, so `Outbox.ngOnDestroy` stops the poll timer.
    providers: [provideState(outboxFeature), provideEffects(outboxEffects)],
  },
];
