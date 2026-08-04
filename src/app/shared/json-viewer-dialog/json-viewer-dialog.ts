import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { NotificationService } from '../../core/notifications/notification.service';

export interface JsonViewerDialogData {
  title: string;
  subtitle?: string;
  /** Raw value from the wire — a JSON *string* for outbox payloads and dead-letter bodies. */
  value: string;
}

/**
 * Read-only viewer for the JSON blobs the API returns as strings
 * (`OutboxMessageResponse.payload`, `DeadLetterLogResponse.messageBody`).
 *
 * Pretty-printing is best-effort: a payload that will not parse is exactly the
 * kind of thing an operator opened this dialog to find, so it is shown verbatim
 * with a note rather than hidden behind an error.
 */
@Component({
  selector: 'app-json-viewer-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.subtitle) {
        <p class="subtitle">{{ data.subtitle }}</p>
      }
      @if (malformed()) {
        <p class="unparsed">
          <mat-icon aria-hidden="true">warning</mat-icon>
          Starts like JSON but does not parse — showing the raw value.
        </p>
      }
      <pre class="json">{{ formatted() }}</pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="copy()">
        <mat-icon>content_copy</mat-icon>
        Copy
      </button>
      <button matButton="filled" mat-dialog-close cdkFocusInitial>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .subtitle {
      margin: 0 0 0.75rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      overflow-wrap: anywhere;
    }

    .unparsed {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }

    .json {
      margin: 0;
      padding: 1rem;
      max-height: 60vh;
      overflow: auto;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container-highest);
      font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.8125rem;
      line-height: 1.5;
      white-space: pre;
      tab-size: 2;
    }
  `,
})
export class JsonViewerDialog {
  protected readonly data = inject<JsonViewerDialogData>(MAT_DIALOG_DATA);
  private readonly notifications = inject(NotificationService);

  private readonly result = signal(tryFormat(this.data.value));

  protected readonly formatted = computed(() => this.result().text);

  /**
   * Warn only when the value *looks* like JSON but will not parse.
   *
   * Plenty of real values are plain scalars — `OutboxMessageResponse.payload`
   * on the live API is a bare order-id GUID, not a document — and flagging
   * those as broken would cry wolf on every single row.
   */
  protected readonly malformed = computed(() => this.result().malformed);

  protected copy(): void {
    navigator.clipboard
      .writeText(this.data.value)
      .then(() => this.notifications.info('Copied to clipboard'))
      .catch(() => this.notifications.error('Could not copy to clipboard'));
  }
}

function tryFormat(value: string): { malformed: boolean; text: string } {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { malformed: false, text: '(empty)' };
  }
  try {
    return { malformed: false, text: JSON.stringify(JSON.parse(trimmed), null, 2) };
  } catch {
    const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
    return { malformed: looksLikeJson, text: value };
  }
}
