import { Routes } from '@angular/router';

import { Outbox } from './outbox';

export const OUTBOX_ROUTES: Routes = [
  { path: '', component: Outbox, title: 'Outbox · TradingApp Ops' },
];
