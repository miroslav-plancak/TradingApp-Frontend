import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DeadLetterLogResponse, ResolveDeadLetterRequest } from '../../../../core/models';

export interface ResolveDialogData {
  entry: DeadLetterLogResponse;
}

/**
 * `POST /api/deadletter/{id}/resolve` — body is `{ resolutionNotes, resolvedBy }`.
 *
 * A real form rather than a bare confirmation: resolving is a triage record, and
 * an entry closed with no explanation is worse than one left open.
 */
@Component({
  selector: 'app-resolve-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Resolve dead letter</h2>
    <mat-dialog-content>
      <p class="context">
        {{ data.entry.reason }}
        <span class="mono">· client order {{ data.entry.clientOrderId }}</span>
      </p>

      <form [formGroup]="form" class="resolve-form">
        <mat-form-field appearance="outline">
          <mat-label>Resolution notes</mat-label>
          <textarea
            matInput
            formControlName="resolutionNotes"
            rows="4"
            placeholder="Root cause and corrective action…"
            cdkFocusInitial
            required
          ></textarea>
          @if (form.controls.resolutionNotes.hasError('required')) {
            <mat-error>Say what was done — this is the triage record.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Resolved by</mat-label>
          <input matInput formControlName="resolvedBy" autocomplete="off" required />
          @if (form.controls.resolvedBy.hasError('required')) {
            <mat-error>Who is resolving this?</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton [mat-dialog-close]="undefined">Cancel</button>
      <button matButton="filled" type="button" [disabled]="form.invalid" (click)="submit()">
        Mark resolved
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .context {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      overflow-wrap: anywhere;
    }

    .mono {
      font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
    }

    .resolve-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: min(28rem, 70vw);
    }
  `,
})
export class ResolveDialog {
  protected readonly data = inject<ResolveDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ResolveDialog, ResolveDeadLetterRequest | undefined>>(MatDialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    resolutionNotes: ['', [Validators.required, Validators.maxLength(1000)]],
    resolvedBy: ['ops', [Validators.required, Validators.maxLength(100)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}
