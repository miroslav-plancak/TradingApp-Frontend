import { Routes } from '@angular/router';

import { Scenarios } from './scenarios';

/**
 * No `provideState`/`provideEffects` here — this is the one feature with no ngRx
 * slice. `ScenarioRunnerService` and `BurstRunnerService` are provided on the
 * component instead, so a run is torn down (and cancelled) with the page.
 */
export const SCENARIOS_ROUTES: Routes = [
  { path: '', component: Scenarios, title: 'Scenarios · TradingApp Ops' },
];
