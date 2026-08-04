import { Routes } from '@angular/router';

import { DeadLetter } from './dead-letter';

export const DEAD_LETTER_ROUTES: Routes = [
  { path: '', component: DeadLetter, title: 'Dead Letter · TradingApp Ops' },
];
