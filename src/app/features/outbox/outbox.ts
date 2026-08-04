import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { filter, take } from 'rxjs';

import { ApiConfigService } from '../../core/config/api-config.service';
import { OutboxMessageResponse } from '../../core/models';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import {
  JsonViewerDialog,
  JsonViewerDialogData,
} from '../../shared/json-viewer-dialog/json-viewer-dialog';
import { OutboxLookup } from './components/outbox-lookup/outbox-lookup';
import { OutboxStats } from './components/outbox-stats/outbox-stats';
import { OutboxTable } from './components/outbox-table/outbox-table';
import { OutboxFilter } from './outbox-api.service';
import { OutboxActions } from './store/outbox.actions';
import {
  selectAllMessages,
  selectAutoRefresh,
  selectDeletingIds,
  selectError,
  selectFilter,
  selectIsEmpty,
  selectIsInitialLoading,
  selectLoading,
  selectLookup,
  selectMarkingIds,
  selectMessageCount,
  selectStats,
  selectStuckCount,
} from './store/outbox.selectors';

const FILTER_LABELS: Record<OutboxFilter, string> = {
  all: 'All',
  unprocessed: 'Unprocessed',
  processed: 'Processed',
};

/** Outbox page container. Selects and dispatches; every child is presentational. */
@Component({
  selector: 'app-outbox',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    OutboxLookup,
    OutboxStats,
    OutboxTable,
  ],
  templateUrl: './outbox.html',
  styleUrl: './outbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Outbox implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly apiConfig = inject(ApiConfigService);

  protected readonly messages = this.store.selectSignal(selectAllMessages);
  protected readonly loading = this.store.selectSignal(selectLoading);
  protected readonly initialLoading = this.store.selectSignal(selectIsInitialLoading);
  protected readonly isEmpty = this.store.selectSignal(selectIsEmpty);
  protected readonly error = this.store.selectSignal(selectError);
  protected readonly filter = this.store.selectSignal(selectFilter);
  protected readonly stats = this.store.selectSignal(selectStats);
  protected readonly markingIds = this.store.selectSignal(selectMarkingIds);
  protected readonly deletingIds = this.store.selectSignal(selectDeletingIds);
  protected readonly autoRefresh = this.store.selectSignal(selectAutoRefresh);
  protected readonly lookup = this.store.selectSignal(selectLookup);
  protected readonly messageCount = this.store.selectSignal(selectMessageCount);
  protected readonly stuckCount = this.store.selectSignal(selectStuckCount);

  protected readonly pollSeconds = Math.round(this.apiConfig.pollIntervalMs / 1000);

  protected readonly filters: readonly { value: OutboxFilter; label: string }[] = (
    ['all', 'unprocessed', 'processed'] as const
  ).map((value) => ({ value, label: FILTER_LABELS[value] }));

  protected readonly filterLabel = computed(() => FILTER_LABELS[this.filter()]);

  /** True while the looked-up message has an action in flight. */
  protected readonly lookupBusy = computed(() => {
    const id = this.lookup().message?.id;
    return id ? this.markingIds().includes(id) || this.deletingIds().includes(id) : false;
  });

  protected readonly liveSummary = computed(() => {
    if (this.loading()) {
      return 'Loading outbox messages';
    }
    if (this.error()) {
      return `Failed to load outbox messages: ${this.error()}`;
    }
    return `${this.messageCount()} ${this.filterLabel().toLowerCase()} messages loaded`;
  });

  ngOnInit(): void {
    this.store.dispatch(OutboxActions.loadOutbox());
  }

  /** See `Orders.ngOnDestroy` — route providers outlive the route, the timer must not. */
  ngOnDestroy(): void {
    if (this.autoRefresh()) {
      this.store.dispatch(OutboxActions.autoRefreshToggled({ enabled: false }));
    }
  }

  protected refresh(): void {
    this.store.dispatch(OutboxActions.loadOutbox());
  }

  protected changeFilter(value: OutboxFilter): void {
    this.store.dispatch(OutboxActions.filterChanged({ filter: value }));
  }

  protected toggleAutoRefresh(enabled: boolean): void {
    this.store.dispatch(OutboxActions.autoRefreshToggled({ enabled }));
  }

  protected lookupMessage(id: string): void {
    this.store.dispatch(OutboxActions.lookupMessage({ id }));
  }

  protected clearLookup(): void {
    this.store.dispatch(OutboxActions.clearLookup());
  }

  protected viewPayload(message: OutboxMessageResponse): void {
    const data: JsonViewerDialogData = {
      title: message.type || 'Outbox payload',
      subtitle: `Message ${message.id}`,
      value: message.payload,
    };
    this.dialog.open(JsonViewerDialog, { data, width: '48rem', autoFocus: 'dialog' });
  }

  protected markProcessed(message: OutboxMessageResponse): void {
    this.confirm({
      title: 'Mark message processed?',
      message:
        'This flags the message as dispatched without actually publishing it, so the processor will skip it. Only do this if you know the message is handled or is safe to drop.',
      confirmLabel: 'Mark processed',
    }).subscribe(() => this.store.dispatch(OutboxActions.markProcessed({ id: message.id })));
  }

  protected deleteMessage(message: OutboxMessageResponse): void {
    this.confirm({
      title: 'Delete message?',
      message: `Outbox message ${message.id} will be permanently deleted.`,
      confirmLabel: 'Delete',
      destructive: true,
    }).subscribe(() => this.store.dispatch(OutboxActions.deleteMessage({ id: message.id })));
  }

  protected deleteAll(): void {
    this.confirm({
      title: 'Delete every outbox message?',
      message:
        'All outbox messages will be permanently deleted, including any still waiting to be dispatched. This cannot be undone.',
      confirmLabel: 'Delete all',
      destructive: true,
    }).subscribe(() => this.store.dispatch(OutboxActions.deleteAllMessages()));
  }

  private confirm(data: ConfirmDialogData) {
    return this.dialog
      .open(ConfirmDialog, { data, width: '30rem', autoFocus: 'dialog' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        take(1),
      );
  }
}
