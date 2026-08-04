import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  CreateDeadLetterRequest,
  DEAD_LETTER_CATEGORY_LABELS,
  DeadLetterCategory,
} from '../../../../core/models';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `POST /api/deadletter` — manual injection, purely for exercising the triage
 * flow without having to make a real message fail.
 *
 * The ids default to freshly generated GUIDs: this form exists to produce test
 * data, so making an operator invent identifiers would be busywork. The original
 * console's version omitted `category` and `correlationId` entirely even though
 * the DTO carries them; both are exposed here.
 */
@Component({
  selector: 'app-dead-letter-inject-form',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './dead-letter-inject-form.html',
  styleUrl: './dead-letter-inject-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadLetterInjectForm {
  readonly submitting = input(false);
  readonly created = output<CreateDeadLetterRequest>();

  private readonly formBuilder = inject(FormBuilder);

  protected readonly categories = [
    DeadLetterCategory.BusinessFailure,
    DeadLetterCategory.InfrastructureFailure,
  ];
  protected readonly categoryLabels = DEAD_LETTER_CATEGORY_LABELS;

  protected readonly form = this.formBuilder.nonNullable.group({
    clientOrderId: [newGuid(), [Validators.required, Validators.pattern(GUID_PATTERN)]],
    reason: ['Manual test injection', [Validators.required, Validators.maxLength(500)]],
    category: [DeadLetterCategory.BusinessFailure as DeadLetterCategory, Validators.required],
    correlationId: [newGuid(), Validators.required],
    messageBody: ['{\n  "test": true\n}', Validators.required],
  });

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.created.emit(this.form.getRawValue());
    // Fresh ids for the next injection, so repeated clicks don't collide.
    this.form.patchValue({ clientOrderId: newGuid(), correlationId: newGuid() });
  }

  protected regenerateIds(): void {
    this.form.patchValue({ clientOrderId: newGuid(), correlationId: newGuid() });
  }
}

function newGuid(): string {
  // `crypto.randomUUID` needs a secure context; localhost qualifies, but fall
  // back rather than break the form on a plain-http deployment.
  return globalThis.crypto?.randomUUID?.() ?? fallbackGuid();
}

function fallbackGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
