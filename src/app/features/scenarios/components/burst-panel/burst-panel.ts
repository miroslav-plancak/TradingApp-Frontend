import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { BurstSettings, BurstState } from '../../burst-runner.service';
import { ScenarioLog } from '../scenario-log/scenario-log';

/** Paced load generator: the original console's Burst Generator. */
@Component({
  selector: 'app-burst-panel',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    ScenarioLog,
  ],
  templateUrl: './burst-panel.html',
  styleUrl: './burst-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BurstPanel {
  readonly state = input.required<BurstState>();
  readonly rate = input<number>(0);

  readonly started = output<BurstSettings>();
  readonly stopped = output<void>();

  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    count: [20, [Validators.required, Validators.min(1), Validators.max(500)]],
    delay: [50, [Validators.required, Validators.min(0), Validators.max(5000)]],
    minQuantity: [10, [Validators.required, Validators.min(1)]],
    maxQuantity: [500, [Validators.required, Validators.min(1)]],
  });

  protected onSubmit(): void {
    if (this.form.invalid || this.state().running) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.started.emit({
      ...value,
      // Tolerate the bounds being entered the wrong way round.
      minQuantity: Math.min(value.minQuantity, value.maxQuantity),
      maxQuantity: Math.max(value.minQuantity, value.maxQuantity),
    });
  }
}
