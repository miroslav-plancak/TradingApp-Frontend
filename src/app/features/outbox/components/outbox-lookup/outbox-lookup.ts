import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { OutboxMessageResponse } from '../../../../core/models';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `GET /api/outboxmessage/{id}` plus the two actions the original console's
 * "Outbox Detail" panel offered on a fetched message.
 */
@Component({
  selector: 'app-outbox-lookup',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './outbox-lookup.html',
  styleUrl: './outbox-lookup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutboxLookup {
  readonly pending = input(false);
  readonly result = input<OutboxMessageResponse | null>(null);
  readonly error = input<string | null>(null);
  readonly busy = input(false);

  readonly lookedUp = output<string>();
  readonly cleared = output<void>();
  readonly payloadOpened = output<OutboxMessageResponse>();
  readonly markedProcessed = output<OutboxMessageResponse>();
  readonly deleted = output<OutboxMessageResponse>();

  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    id: ['', [Validators.required, Validators.pattern(GUID_PATTERN)]],
  });

  protected onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }
    this.lookedUp.emit(this.form.getRawValue().id.trim());
  }

  protected onClear(): void {
    this.form.reset();
    this.cleared.emit();
  }
}
