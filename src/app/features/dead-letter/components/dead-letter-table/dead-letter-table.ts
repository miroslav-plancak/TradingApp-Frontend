import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DeadLetterLogResponse } from '../../../../core/models';
import { DeadLetterCategoryChip } from '../../../../shared/dead-letter-category-chip/dead-letter-category-chip';

@Component({
  selector: 'app-dead-letter-table',
  imports: [
    DatePipe,
    DeadLetterCategoryChip,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './dead-letter-table.html',
  styleUrl: './dead-letter-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadLetterTable {
  readonly entries = input.required<readonly DeadLetterLogResponse[]>();
  readonly resolvingIds = input<readonly string[]>([]);
  readonly deletingIds = input<readonly string[]>([]);

  readonly bodyOpened = output<DeadLetterLogResponse>();
  readonly resolved = output<DeadLetterLogResponse>();
  readonly deleted = output<DeadLetterLogResponse>();

  protected readonly columns = [
    'state',
    'category',
    'reason',
    'clientOrderId',
    'createdAt',
    'resolvedAt',
    'actions',
  ];

  private readonly resolvingSet = computed(() => new Set(this.resolvingIds()));
  private readonly deletingSet = computed(() => new Set(this.deletingIds()));

  protected isBusy(entry: DeadLetterLogResponse): boolean {
    return this.resolvingSet().has(entry.id) || this.deletingSet().has(entry.id);
  }

  protected trackById(_index: number, entry: DeadLetterLogResponse): string {
    return entry.id;
  }
}
