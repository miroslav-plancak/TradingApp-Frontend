import { createActionGroup, emptyProps, props } from '@ngrx/store';

import {
  CreateDeadLetterRequest,
  DeadLetterLogResponse,
  DeadLetterStats,
  ResolveDeadLetterRequest,
} from '../../../core/models';
import { DeadLetterFilter } from '../dead-letter-api.service';

/**
 * As in Orders and Outbox, `loadDeadLetters` is the single action behind the
 * page opening, the refresh button, the filter changing, and the poll timer.
 *
 * There are two lookups here rather than one — by dead-letter id and by client
 * order id — because the API exposes them as separate endpoints. They share a
 * single lookup slot in state, since only one result is ever on screen.
 */
export const DeadLetterActions = createActionGroup({
  source: 'Dead Letter',
  events: {
    'Load Dead Letters': emptyProps(),
    'Load Dead Letters Success': props<{
      entries: DeadLetterLogResponse[];
      stats: DeadLetterStats;
    }>(),
    'Load Dead Letters Failure': props<{ error: string }>(),

    'Filter Changed': props<{ filter: DeadLetterFilter }>(),

    'Lookup By Id': props<{ id: string }>(),
    'Lookup By Client Order Id': props<{ clientOrderId: string }>(),
    'Lookup Success': props<{ entry: DeadLetterLogResponse }>(),
    'Lookup Failure': props<{ error: string }>(),
    'Clear Lookup': emptyProps(),

    'Resolve Entry': props<{ id: string; request: ResolveDeadLetterRequest }>(),
    'Resolve Entry Success': props<{ entry: DeadLetterLogResponse }>(),
    'Resolve Entry Failure': props<{ id: string; error: string }>(),

    /** Manual injection — this exists to generate test data, not for real triage. */
    'Create Entry': props<{ request: CreateDeadLetterRequest }>(),
    'Create Entry Success': props<{ entry: DeadLetterLogResponse }>(),
    'Create Entry Failure': props<{ error: string }>(),

    'Delete Entry': props<{ id: string }>(),
    'Delete Entry Success': props<{ id: string }>(),
    'Delete Entry Failure': props<{ id: string; error: string }>(),

    'Delete All Entries': emptyProps(),
    'Delete All Entries Success': props<{ deletedCount: number }>(),
    'Delete All Entries Failure': props<{ error: string }>(),

    'Auto Refresh Toggled': props<{ enabled: boolean }>(),
  },
});
