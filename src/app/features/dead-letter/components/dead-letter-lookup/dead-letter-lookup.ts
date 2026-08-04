import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { DeadLetterLogResponse } from '../../../../core/models';
import { DeadLetterCategoryChip } from '../../../../shared/dead-letter-category-chip/dead-letter-category-chip';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The two lookups the API offers — by dead-letter id and by client order id.
 *
 * Client order id is the one an operator usually has: it is what the Orders tab
 * shows and what appears in logs when a message fails.
 */
@Component({
  selector: 'app-dead-letter-lookup',
  imports: [
    DatePipe,
    DeadLetterCategoryChip,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './dead-letter-lookup.html',
  styleUrl: './dead-letter-lookup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadLetterLookup {
  readonly pending = input(false);
  readonly result = input<DeadLetterLogResponse | null>(null);
  readonly error = input<string | null>(null);
  readonly busy = input(false);

  readonly lookedUpById = output<string>();
  readonly lookedUpByClientOrderId = output<string>();
  readonly cleared = output<void>();
  readonly bodyOpened = output<DeadLetterLogResponse>();
  readonly resolved = output<DeadLetterLogResponse>();
  readonly deleted = output<DeadLetterLogResponse>();

  private readonly formBuilder = inject(FormBuilder);

  protected readonly idForm = this.formBuilder.nonNullable.group({
    id: ['', [Validators.required, Validators.pattern(GUID_PATTERN)]],
  });

  protected readonly clientOrderForm = this.formBuilder.nonNullable.group({
    clientOrderId: ['', [Validators.required, Validators.pattern(GUID_PATTERN)]],
  });

  protected submitById(): void {
    if (this.idForm.invalid || this.pending()) {
      this.idForm.markAllAsTouched();
      return;
    }
    this.lookedUpById.emit(this.idForm.getRawValue().id.trim());
  }

  protected submitByClientOrderId(): void {
    if (this.clientOrderForm.invalid || this.pending()) {
      this.clientOrderForm.markAllAsTouched();
      return;
    }
    this.lookedUpByClientOrderId.emit(this.clientOrderForm.getRawValue().clientOrderId.trim());
  }

  protected onClear(): void {
    this.idForm.reset();
    this.clientOrderForm.reset();
    this.cleared.emit();
  }
}
