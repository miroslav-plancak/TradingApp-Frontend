import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { OrderResponse } from '../../../../core/models';
import { OrderStatusChip } from '../../../../shared/order-status-chip/order-status-chip';

/** Loose GUID check — enough to catch a typo before spending a round trip. */
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `GET /api/order/{orderId}` — fetch a single order by its id. */
@Component({
  selector: 'app-order-lookup',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    OrderStatusChip,
    ReactiveFormsModule,
  ],
  templateUrl: './order-lookup.html',
  styleUrl: './order-lookup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderLookup {
  readonly pending = input(false);
  readonly result = input<OrderResponse | null>(null);
  readonly error = input<string | null>(null);

  readonly lookedUp = output<string>();
  readonly cleared = output<void>();

  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    orderId: ['', [Validators.required, Validators.pattern(GUID_PATTERN)]],
  });

  protected onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }
    this.lookedUp.emit(this.form.getRawValue().orderId.trim());
  }

  protected onClear(): void {
    this.form.reset();
    this.cleared.emit();
  }
}
