import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { OutboxMessageStats } from '../../../../core/models';

/**
 * The four counters from `GET /api/outboxmessage/stats`.
 *
 * These come from the server and cover *every* message, so they intentionally
 * do not agree with the row count when a filter is applied.
 */
@Component({
  selector: 'app-outbox-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stats-strip">
      @for (tile of tiles(); track tile.label) {
        <div class="stat-tile" [class]="'tone-' + tile.tone">
          <span class="stat-value">{{ tile.value }}</span>
          <span class="stat-label">{{ tile.label }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .stats-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .stat-tile {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 8rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-low);
    }

    .stat-value {
      font: var(--mat-sys-headline-small);
    }

    .stat-label {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .tone-positive .stat-value {
      color: #4ade80;
    }

    .tone-pending .stat-value {
      color: var(--mat-sys-tertiary);
    }

    .tone-info .stat-value {
      color: var(--mat-sys-primary);
    }
  `,
})
export class OutboxStats {
  readonly stats = input<OutboxMessageStats | null>(null);

  protected readonly tiles = computed(() => {
    const stats = this.stats();
    return [
      { label: 'Total', value: stats?.totalCount ?? 0, tone: 'neutral' },
      { label: 'Processed', value: stats?.processedCount ?? 0, tone: 'positive' },
      { label: 'Pending', value: stats?.unprocessedCount ?? 0, tone: 'pending' },
      { label: 'Last 24h', value: stats?.last24Hours ?? 0, tone: 'info' },
    ];
  });
}
