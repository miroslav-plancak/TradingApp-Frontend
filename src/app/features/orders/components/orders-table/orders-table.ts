import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { OrderResponse } from '../../../../core/models';
import { OrderStatusChip } from '../../../../shared/order-status-chip/order-status-chip';

@Component({
  selector: 'app-orders-table',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    OrderStatusChip,
  ],
  templateUrl: './orders-table.html',
  styleUrl: './orders-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersTable {
  readonly orders = input.required<readonly OrderResponse[]>();
  readonly deletingIds = input<readonly string[]>([]);

  readonly deleted = output<OrderResponse>();

  protected readonly columns = [
    'status',
    'clientOrderId',
    'quantity',
    'price',
    'isProcessed',
    'createdAt',
    'updatedAt',
    'actions',
  ];

  /** Set lookup keeps the per-row check O(1) while a bulk delete is in flight. */
  private readonly deletingSet = computed(() => new Set(this.deletingIds()));

  protected isDeleting(order: OrderResponse): boolean {
    return this.deletingSet().has(order.id);
  }

  /** Keeps rows (and their focus) stable when a poll replaces the whole list. */
  protected trackById(_index: number, order: OrderResponse): string {
    return order.id;
  }
}
