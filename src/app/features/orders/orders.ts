import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { filter, take } from 'rxjs';

import { ApiConfigService } from '../../core/config/api-config.service';
import { CreateOrderRequest, ORDER_STATUSES, OrderResponse } from '../../core/models';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { OrderCreateForm } from './components/order-create-form/order-create-form';
import { OrderLookup } from './components/order-lookup/order-lookup';
import { OrdersTable } from './components/orders-table/orders-table';
import { OrdersActions } from './store/orders.actions';
import {
  selectAllOrders,
  selectAutoRefresh,
  selectCreating,
  selectDeletingIds,
  selectError,
  selectIsEmpty,
  selectIsInitialLoading,
  selectLoading,
  selectLookup,
  selectOrderCount,
  selectProcessedCount,
  selectStatusCounts,
} from './store/orders.selectors';

/**
 * Orders page container.
 *
 * Holds no state of its own — it selects from the store and dispatches. Every
 * child is presentational, which is the split Phases 3 and 4 copy.
 */
@Component({
  selector: 'app-orders',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    OrderCreateForm,
    OrderLookup,
    OrdersTable,
  ],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Orders implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly apiConfig = inject(ApiConfigService);

  protected readonly orders = this.store.selectSignal(selectAllOrders);
  protected readonly loading = this.store.selectSignal(selectLoading);
  protected readonly initialLoading = this.store.selectSignal(selectIsInitialLoading);
  protected readonly isEmpty = this.store.selectSignal(selectIsEmpty);
  protected readonly error = this.store.selectSignal(selectError);
  protected readonly creating = this.store.selectSignal(selectCreating);
  protected readonly deletingIds = this.store.selectSignal(selectDeletingIds);
  protected readonly autoRefresh = this.store.selectSignal(selectAutoRefresh);
  protected readonly lookup = this.store.selectSignal(selectLookup);
  protected readonly orderCount = this.store.selectSignal(selectOrderCount);
  protected readonly processedCount = this.store.selectSignal(selectProcessedCount);
  protected readonly statusCounts = this.store.selectSignal(selectStatusCounts);

  protected readonly pollSeconds = Math.round(this.apiConfig.pollIntervalMs / 1000);

  /**
   * Status summary in the backend's declaration order — `keyvalue` would sort
   * these alphabetically, which puts REJECTED before PENDING_ACK.
   */
  protected readonly statusTiles = computed(() => {
    const counts = this.statusCounts();
    return ORDER_STATUSES.map((status) => ({
      status,
      count: counts[status],
      label: status.replace(/_/g, ' '),
    }));
  });

  /** Announced to screen readers whenever the list settles. */
  protected readonly liveSummary = computed(() => {
    if (this.loading()) {
      return 'Loading orders';
    }
    if (this.error()) {
      return `Failed to load orders: ${this.error()}`;
    }
    return `${this.orderCount()} orders loaded, ${this.processedCount()} processed`;
  });

  ngOnInit(): void {
    this.store.dispatch(OrdersActions.loadOrders());
  }

  /**
   * Turn auto-refresh off when the page is left.
   *
   * Verified in the browser: state and effects registered through a route's
   * `providers` are NOT torn down when that route is deactivated, so without
   * this the timer keeps polling the API from the Outbox tab, forever. Turning
   * the toggle off is enough — the polling effect's `switchMap` cancels the
   * timer on the `enabled: false` branch.
   */
  ngOnDestroy(): void {
    if (this.autoRefresh()) {
      this.store.dispatch(OrdersActions.autoRefreshToggled({ enabled: false }));
    }
  }

  protected refresh(): void {
    this.store.dispatch(OrdersActions.loadOrders());
  }

  protected toggleAutoRefresh(enabled: boolean): void {
    this.store.dispatch(OrdersActions.autoRefreshToggled({ enabled }));
  }

  protected createOrder(request: CreateOrderRequest): void {
    this.store.dispatch(OrdersActions.createOrder({ request }));
  }

  protected lookupOrder(orderId: string): void {
    this.store.dispatch(OrdersActions.lookupOrder({ orderId }));
  }

  protected clearLookup(): void {
    this.store.dispatch(OrdersActions.clearLookup());
  }

  protected deleteOrder(order: OrderResponse): void {
    this.confirm({
      title: 'Delete order?',
      message: `Order ${order.clientOrderId} will be permanently deleted.`,
      confirmLabel: 'Delete',
      destructive: true,
    }).subscribe(() => this.store.dispatch(OrdersActions.deleteOrder({ orderId: order.id })));
  }

  protected deleteAllOrders(): void {
    this.confirm({
      title: 'Delete every order?',
      message: `All ${this.orderCount()} orders will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete all',
      destructive: true,
    }).subscribe(() => this.store.dispatch(OrdersActions.deleteAllOrders()));
  }

  /** Emits once, only when the operator confirms. */
  private confirm(data: ConfirmDialogData) {
    return this.dialog
      .open(ConfirmDialog, { data, width: '28rem', autoFocus: 'dialog' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        take(1),
      );
  }
}
