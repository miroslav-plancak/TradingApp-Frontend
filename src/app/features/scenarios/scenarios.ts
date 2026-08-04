import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { filter, forkJoin, take } from 'rxjs';

import { NotificationService } from '../../core/notifications/notification.service';
import { toErrorMessage } from '../../core/api/http-error';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { DeadLetterApiService } from '../dead-letter/dead-letter-api.service';
import { OrdersApiService } from '../orders/orders-api.service';
import { OutboxApiService } from '../outbox/outbox-api.service';
import { BurstPanel } from './components/burst-panel/burst-panel';
import { ScenarioCard } from './components/scenario-card/scenario-card';
import { BurstRunnerService, BurstSettings } from './burst-runner.service';
import { SCENARIO_DEFINITIONS, ScenarioId } from './scenario.model';
import { ScenarioRunnerService } from './scenario-runner.service';

interface ChaosNote {
  title: string;
  tone: 'danger' | 'warn';
  steps: string[];
}

/**
 * Scenarios page.
 *
 * The only feature without an ngRx slice: run state is page-local and lives in
 * `ScenarioRunnerService` / `BurstRunnerService` (see PROGRESS.md for why).
 */
@Component({
  selector: 'app-scenarios',
  imports: [BurstPanel, MatButtonModule, MatCardModule, MatIconModule, ScenarioCard],
  templateUrl: './scenarios.html',
  styleUrl: './scenarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ScenarioRunnerService, BurstRunnerService],
})
export class Scenarios {
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly outboxApi = inject(OutboxApiService);
  private readonly deadLetterApi = inject(DeadLetterApiService);

  protected readonly runner = inject(ScenarioRunnerService);
  protected readonly burst = inject(BurstRunnerService);

  protected readonly definitions = SCENARIO_DEFINITIONS;
  protected readonly purging = signal(false);

  /** Carried over from the original console — these need action outside the UI. */
  protected readonly chaosNotes: readonly ChaosNote[] = [
    {
      title: 'DB outage during create',
      tone: 'danger',
      steps: [
        'Stop SQL Server, then POST /api/order.',
        'Expect a 500 with no orphaned rows.',
        'Orders and OutboxMessages must be unchanged — the transaction rolls back.',
      ],
    },
    {
      title: 'Service Bus down (queue)',
      tone: 'warn',
      steps: [
        'Disable the queue, then submit orders.',
        'Outbox messages stay unprocessed and RetryCount climbs.',
        'After 5 retries they move to QuarantinedOutboxMessages.',
        'Re-enable the queue — auto-resurrection kicks in.',
      ],
    },
    {
      title: 'Service Bus down (topic)',
      tone: 'danger',
      steps: [
        'Disable the topic, then process orders.',
        'OrderExecutionProvider catches the exception and writes to UnpublishedTopicMessages.',
        'ScheduledUnpublishedTopicMessagesProcessor retries publishing directly.',
      ],
    },
    {
      title: 'Consumer crash mid-flow',
      tone: 'warn',
      steps: [
        'Kill OrderExecutionProvider during a burst.',
        'Service Bus redelivers; the atomic WHERE IsProcessed = 0 prevents duplicate updates.',
        'Restart the consumer — the backlog drains cleanly.',
      ],
    },
    {
      title: 'Poison message → DLQ',
      tone: 'danger',
      steps: [
        'Force the consumer to throw on a specific ClientOrderId.',
        'After the max delivery count the message goes to the DLQ.',
        'DeadLetterQueueProcessor writes it to DeadLetterLogs — triage it in the Dead Letter tab.',
      ],
    },
  ];

  protected startScenario(id: ScenarioId, params: Record<string, number>): void {
    void this.runner.start(id, params);
  }

  protected stopScenario(id: ScenarioId): void {
    this.runner.cancel(id);
  }

  protected startBurst(settings: BurstSettings): void {
    void this.burst.start(settings);
  }

  protected stopBurst(): void {
    this.burst.stop();
  }

  /**
   * The most destructive control in the console: empties Orders, OutboxMessages
   * and DeadLetterLogs. Kept here rather than in the global toolbar so it takes
   * a deliberate visit to reach.
   */
  protected purgeDatabase(): void {
    const data: ConfirmDialogData = {
      title: 'Purge the database?',
      message:
        'Deletes every row from Orders, OutboxMessages and DeadLetterLogs. Anything still in flight through the pipeline will be orphaned. This cannot be undone.',
      confirmLabel: 'Purge everything',
      destructive: true,
    };

    this.dialog
      .open(ConfirmDialog, { data, width: '32rem', autoFocus: 'dialog' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        take(1),
      )
      .subscribe(() => {
        this.purging.set(true);
        forkJoin({
          orders: this.ordersApi.deleteAll(),
          outbox: this.outboxApi.deleteAll(),
          deadLetters: this.deadLetterApi.deleteAll(),
        }).subscribe({
          next: ({ orders, outbox, deadLetters }) => {
            this.purging.set(false);
            this.notifications.success(
              `Purged ${orders.deletedCount} orders, ${outbox.deletedCount} outbox messages, ${deadLetters.deletedCount} dead letters`,
            );
            // Every other feature's slice now holds rows that no longer exist,
            // but each reloads on entry, so no cross-feature invalidation is
            // needed here — deliberately keeping this page decoupled.
          },
          error: (error: unknown) => {
            this.purging.set(false);
            this.notifications.error(toErrorMessage(error));
          },
        });
      });
  }
}
