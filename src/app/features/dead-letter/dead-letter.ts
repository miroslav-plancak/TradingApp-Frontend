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
import {
  CreateDeadLetterRequest,
  DEAD_LETTER_CATEGORY_LABELS,
  DeadLetterCategory,
  DeadLetterLogResponse,
  ResolveDeadLetterRequest,
} from '../../core/models';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import {
  JsonViewerDialog,
  JsonViewerDialogData,
} from '../../shared/json-viewer-dialog/json-viewer-dialog';
import { DeadLetterInjectForm } from './components/dead-letter-inject-form/dead-letter-inject-form';
import { DeadLetterLookup } from './components/dead-letter-lookup/dead-letter-lookup';
import { DeadLetterStats } from './components/dead-letter-stats/dead-letter-stats';
import { DeadLetterTable } from './components/dead-letter-table/dead-letter-table';
import { ResolveDialog, ResolveDialogData } from './components/resolve-dialog/resolve-dialog';
import { DeadLetterFilter } from './dead-letter-api.service';
import { DeadLetterActions } from './store/dead-letter.actions';
import {
  selectAllEntries,
  selectAutoRefresh,
  selectCategoryCounts,
  selectCreating,
  selectDeletingIds,
  selectEntryCount,
  selectError,
  selectFilter,
  selectIsEmpty,
  selectIsInitialLoading,
  selectLoading,
  selectLookup,
  selectResolvingIds,
  selectStats,
} from './store/dead-letter.selectors';

const FILTER_LABELS: Record<DeadLetterFilter, string> = {
  all: 'All',
  unresolved: 'Unresolved',
};

/** Dead Letter page container. Selects and dispatches; children are presentational. */
@Component({
  selector: 'app-dead-letter',
  imports: [
    DeadLetterInjectForm,
    DeadLetterLookup,
    DeadLetterStats,
    DeadLetterTable,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './dead-letter.html',
  styleUrl: './dead-letter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadLetter implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly apiConfig = inject(ApiConfigService);

  protected readonly entries = this.store.selectSignal(selectAllEntries);
  protected readonly loading = this.store.selectSignal(selectLoading);
  protected readonly initialLoading = this.store.selectSignal(selectIsInitialLoading);
  protected readonly isEmpty = this.store.selectSignal(selectIsEmpty);
  protected readonly error = this.store.selectSignal(selectError);
  protected readonly filter = this.store.selectSignal(selectFilter);
  protected readonly stats = this.store.selectSignal(selectStats);
  protected readonly resolvingIds = this.store.selectSignal(selectResolvingIds);
  protected readonly deletingIds = this.store.selectSignal(selectDeletingIds);
  protected readonly creating = this.store.selectSignal(selectCreating);
  protected readonly autoRefresh = this.store.selectSignal(selectAutoRefresh);
  protected readonly lookup = this.store.selectSignal(selectLookup);
  protected readonly entryCount = this.store.selectSignal(selectEntryCount);
  protected readonly categoryCounts = this.store.selectSignal(selectCategoryCounts);

  protected readonly pollSeconds = Math.round(this.apiConfig.pollIntervalMs / 1000);

  protected readonly filters: readonly { value: DeadLetterFilter; label: string }[] = (
    ['all', 'unresolved'] as const
  ).map((value) => ({ value, label: FILTER_LABELS[value] }));

  protected readonly businessCount = computed(
    () => this.categoryCounts()[DeadLetterCategory.BusinessFailure],
  );
  protected readonly infrastructureCount = computed(
    () => this.categoryCounts()[DeadLetterCategory.InfrastructureFailure],
  );
  protected readonly categoryLabels = DEAD_LETTER_CATEGORY_LABELS;

  protected readonly lookupBusy = computed(() => {
    const id = this.lookup().entry?.id;
    return id ? this.resolvingIds().includes(id) || this.deletingIds().includes(id) : false;
  });

  protected readonly liveSummary = computed(() => {
    if (this.loading()) {
      return 'Loading dead letters';
    }
    if (this.error()) {
      return `Failed to load dead letters: ${this.error()}`;
    }
    return `${this.entryCount()} dead letters loaded`;
  });

  ngOnInit(): void {
    this.store.dispatch(DeadLetterActions.loadDeadLetters());
  }

  /** See `Orders.ngOnDestroy` — route providers outlive the route, the timer must not. */
  ngOnDestroy(): void {
    if (this.autoRefresh()) {
      this.store.dispatch(DeadLetterActions.autoRefreshToggled({ enabled: false }));
    }
  }

  protected refresh(): void {
    this.store.dispatch(DeadLetterActions.loadDeadLetters());
  }

  protected changeFilter(value: DeadLetterFilter): void {
    this.store.dispatch(DeadLetterActions.filterChanged({ filter: value }));
  }

  protected toggleAutoRefresh(enabled: boolean): void {
    this.store.dispatch(DeadLetterActions.autoRefreshToggled({ enabled }));
  }

  protected lookupById(id: string): void {
    this.store.dispatch(DeadLetterActions.lookupById({ id }));
  }

  protected lookupByClientOrderId(clientOrderId: string): void {
    this.store.dispatch(DeadLetterActions.lookupByClientOrderId({ clientOrderId }));
  }

  protected clearLookup(): void {
    this.store.dispatch(DeadLetterActions.clearLookup());
  }

  protected injectEntry(request: CreateDeadLetterRequest): void {
    this.store.dispatch(DeadLetterActions.createEntry({ request }));
  }

  protected viewBody(entry: DeadLetterLogResponse): void {
    const data: JsonViewerDialogData = {
      title: 'Failed message body',
      subtitle: `${entry.reason} · client order ${entry.clientOrderId}`,
      value: entry.messageBody,
    };
    this.dialog.open(JsonViewerDialog, { data, width: '48rem', autoFocus: 'dialog' });
  }

  protected resolveEntry(entry: DeadLetterLogResponse): void {
    const data: ResolveDialogData = { entry };
    this.dialog
      .open(ResolveDialog, { data, autoFocus: 'dialog' })
      .afterClosed()
      .pipe(
        filter((request): request is ResolveDeadLetterRequest => !!request),
        take(1),
      )
      .subscribe((request) =>
        this.store.dispatch(DeadLetterActions.resolveEntry({ id: entry.id, request })),
      );
  }

  protected deleteEntry(entry: DeadLetterLogResponse): void {
    this.confirm({
      title: 'Delete dead letter?',
      message: `Entry ${entry.id} will be permanently deleted. Deleting is not resolving — the triage record goes with it.`,
      confirmLabel: 'Delete',
      destructive: true,
    }).subscribe(() => this.store.dispatch(DeadLetterActions.deleteEntry({ id: entry.id })));
  }

  protected deleteAll(): void {
    this.confirm({
      title: 'Delete every dead letter?',
      message:
        'All dead letter entries will be permanently deleted, resolved and unresolved alike. This cannot be undone.',
      confirmLabel: 'Delete all',
      destructive: true,
    }).subscribe(() => this.store.dispatch(DeadLetterActions.deleteAllEntries()));
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
