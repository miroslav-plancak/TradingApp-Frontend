import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { OutboxMessageResponse, OutboxMessageStats } from '../../../core/models';
import { OutboxFilter } from '../outbox-api.service';

/**
 * As in Orders, `loadOutbox` is the single action dispatched by the page
 * opening, the refresh button, the filter changing, and the poll timer — so
 * nothing downstream can tell those triggers apart.
 *
 * The list and the stats are loaded together and land in one success action:
 * they are two requests but a single view of the outbox, and splitting them
 * lets the tiles disagree with the table mid-poll.
 */
export const OutboxActions = createActionGroup({
  source: 'Outbox',
  events: {
    'Load Outbox': emptyProps(),
    'Load Outbox Success': props<{
      messages: OutboxMessageResponse[];
      stats: OutboxMessageStats;
    }>(),
    'Load Outbox Failure': props<{ error: string }>(),

    /** All / unprocessed / processed. Triggers a reload of the matching endpoint. */
    'Filter Changed': props<{ filter: OutboxFilter }>(),

    'Lookup Message': props<{ id: string }>(),
    'Lookup Message Success': props<{ message: OutboxMessageResponse }>(),
    'Lookup Message Failure': props<{ error: string }>(),
    'Clear Lookup': emptyProps(),

    'Mark Processed': props<{ id: string }>(),
    'Mark Processed Success': props<{ message: OutboxMessageResponse }>(),
    'Mark Processed Failure': props<{ id: string; error: string }>(),

    'Delete Message': props<{ id: string }>(),
    'Delete Message Success': props<{ id: string }>(),
    'Delete Message Failure': props<{ id: string; error: string }>(),

    'Delete All Messages': emptyProps(),
    'Delete All Messages Success': props<{ deletedCount: number }>(),
    'Delete All Messages Failure': props<{ error: string }>(),

    'Auto Refresh Toggled': props<{ enabled: boolean }>(),

    /** A SignalR push carrying one already-updated message — patched straight into the entity store. */
    'Message Pushed': props<{ message: OutboxMessageResponse }>(),
  },
});
