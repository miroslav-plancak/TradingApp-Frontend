import { Routes } from '@angular/router';

/**
 * One lazy-loaded route per tab of the original console. Each feature owns its
 * own `*.routes.ts` so it can grow child routes (detail views, dialogs-as-routes)
 * without touching this file.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  {
    path: 'orders',
    loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
  },
  {
    path: 'outbox',
    loadChildren: () => import('./features/outbox/outbox.routes').then((m) => m.OUTBOX_ROUTES),
  },
  {
    path: 'dead-letter',
    loadChildren: () =>
      import('./features/dead-letter/dead-letter.routes').then((m) => m.DEAD_LETTER_ROUTES),
  },
  {
    path: 'scenarios',
    loadChildren: () =>
      import('./features/scenarios/scenarios.routes').then((m) => m.SCENARIOS_ROUTES),
  },
  {
    path: 'architecture',
    loadChildren: () =>
      import('./features/architecture/architecture.routes').then((m) => m.ARCHITECTURE_ROUTES),
  },
  { path: '**', redirectTo: 'orders' },
];
