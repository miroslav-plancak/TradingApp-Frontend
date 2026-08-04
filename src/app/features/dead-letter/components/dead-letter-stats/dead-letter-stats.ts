import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DeadLetterStats as DeadLetterStatsDto } from '../../../../core/models';

/** The four counters from `GET /api/deadletter/stats`. Global, not filtered. */
@Component({
  selector: 'app-dead-letter-stats',
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

    .tone-danger .stat-value {
      color: var(--mat-sys-error);
    }

    .tone-positive .stat-value {
      color: #4ade80;
    }

    .tone-info .stat-value {
      color: var(--mat-sys-primary);
    }
  `,
})
export class DeadLetterStats {
  readonly stats = input<DeadLetterStatsDto | null>(null);

  protected readonly tiles = computed(() => {
    const stats = this.stats();
    return [
      { label: 'Total', value: stats?.totalCount ?? 0, tone: 'neutral' },
      { label: 'Unresolved', value: stats?.unresolvedCount ?? 0, tone: 'danger' },
      { label: 'Resolved', value: stats?.resolvedCount ?? 0, tone: 'positive' },
      { label: 'Last 24h', value: stats?.last24Hours ?? 0, tone: 'info' },
    ];
  });
}
