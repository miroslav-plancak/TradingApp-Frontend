import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { DeadLetter } from './dead-letter';
import * as deadLetterEffects from './store/dead-letter.effects';
import { deadLetterFeature } from './store/dead-letter.reducer';

export const DEAD_LETTER_ROUTES: Routes = [
  {
    path: '',
    component: DeadLetter,
    title: 'Dead Letter · TradingApp Ops',
    // As in Orders and Outbox: registered with the lazy chunk, not torn down on
    // leaving, so `DeadLetter.ngOnDestroy` stops the poll timer.
    providers: [provideState(deadLetterFeature), provideEffects(deadLetterEffects)],
  },
];
