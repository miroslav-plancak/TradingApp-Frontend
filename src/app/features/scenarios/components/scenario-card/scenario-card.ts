import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { ScenarioDefinition, ScenarioRun, ScenarioStatus } from '../../scenario.model';
import { ScenarioLog } from '../scenario-log/scenario-log';

const STATUS_LABELS: Record<ScenarioStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  passed: 'Passed',
  partial: 'Partial',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** One scenario: description, its parameters, a run/stop control, and its log. */
@Component({
  selector: 'app-scenario-card',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ScenarioLog,
  ],
  templateUrl: './scenario-card.html',
  styleUrl: './scenario-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioCard {
  readonly definition = input.required<ScenarioDefinition>();
  readonly run = input.required<ScenarioRun>();

  readonly started = output<Record<string, number>>();
  readonly stopped = output<void>();

  /** Parameter values live here, not in the store — they are form state. */
  private readonly overrides = signal<Record<string, number>>({});

  protected readonly isRunning = computed(() => this.run().status === 'running');

  protected readonly statusLabel = computed(() => STATUS_LABELS[this.run().status]);

  protected readonly durationSeconds = computed(() => {
    const { startedAt, finishedAt } = this.run();
    return startedAt && finishedAt ? ((finishedAt - startedAt) / 1000).toFixed(1) : null;
  });

  protected valueOf(key: string): number {
    const definition = this.definition().params.find((param) => param.key === key);
    return this.overrides()[key] ?? definition?.value ?? 0;
  }

  protected setValue(key: string, value: number): void {
    this.overrides.update((current) => ({ ...current, [key]: value }));
  }

  protected onStart(): void {
    const params = Object.fromEntries(
      this.definition().params.map((param) => [param.key, this.valueOf(param.key)]),
    );
    this.started.emit(params);
  }
}
