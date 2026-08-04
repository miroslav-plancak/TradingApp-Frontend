import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { OutboxMessageResponse } from '../../../../core/models';
import { QUARANTINE_RETRY_THRESHOLD } from '../../store/outbox.selectors';

@Component({
  selector: 'app-outbox-table',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './outbox-table.html',
  styleUrl: './outbox-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutboxTable {
  readonly messages = input.required<readonly OutboxMessageResponse[]>();
  readonly markingIds = input<readonly string[]>([]);
  readonly deletingIds = input<readonly string[]>([]);

  readonly payloadOpened = output<OutboxMessageResponse>();
  readonly markedProcessed = output<OutboxMessageResponse>();
  readonly deleted = output<OutboxMessageResponse>();

  protected readonly columns = [
    'state',
    'type',
    'retryCount',
    'id',
    'createdAt',
    'processedAt',
    'actions',
  ];

  protected readonly quarantineThreshold = QUARANTINE_RETRY_THRESHOLD;

  private readonly markingSet = computed(() => new Set(this.markingIds()));
  private readonly deletingSet = computed(() => new Set(this.deletingIds()));

  protected isBusy(message: OutboxMessageResponse): boolean {
    return this.markingSet().has(message.id) || this.deletingSet().has(message.id);
  }

  /** At or past the quarantine threshold this message is stuck, not just retrying. */
  protected isStuck(message: OutboxMessageResponse): boolean {
    return message.retryCount >= QUARANTINE_RETRY_THRESHOLD;
  }

  protected trackById(_index: number, message: OutboxMessageResponse): string {
    return message.id;
  }
}
