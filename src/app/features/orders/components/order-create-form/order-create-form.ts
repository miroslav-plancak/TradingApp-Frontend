import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { CreateOrderRequest } from '../../../../core/models';

/**
 * `POST /api/order` — the DTO is just `{ quantity, price }`.
 *
 * Purely presentational: it validates and emits, and knows nothing about the
 * store. The container decides what a submission means.
 */
@Component({
  selector: 'app-order-create-form',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './order-create-form.html',
  styleUrl: './order-create-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderCreateForm {
  readonly submitting = input(false);
  readonly created = output<CreateOrderRequest>();

  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    quantity: [100, [Validators.required, Validators.min(1), Validators.max(1_000_000)]],
    price: [10.5, [Validators.required, Validators.min(0.01)]],
  });

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.created.emit(this.form.getRawValue());
  }
}
