import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  viewChild,
} from '@angular/core';

import { LogLine } from '../../scenario.model';

/**
 * Append-only run log.
 *
 * Scrolls itself to the bottom as lines arrive, and is marked as a live region
 * so a screen reader hears progress instead of silence during a 90-second run.
 */
@Component({
  selector: 'app-scenario-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pre
      #panel
      class="log"
      role="log"
      aria-live="polite"
      aria-label="Scenario output"
    >@for (line of lines(); track $index) {<span class="line" [class]="'tone-' + line.tone">{{ line.text }}</span>
}@empty {<span class="tone-muted">idle.</span>}</pre>
  `,
  styles: `
    .log {
      margin: 0;
      padding: 0.75rem 1rem;
      max-height: 18rem;
      overflow: auto;
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container-highest);
      font-family: ui-monospace, 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.75rem;
      line-height: 1.6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .line {
      display: block;
    }

    .tone-step {
      color: var(--mat-sys-primary);
    }

    .tone-heading {
      color: var(--mat-sys-tertiary);
    }

    .tone-success {
      color: #4ade80;
    }

    .tone-warn {
      color: #fbbf24;
    }

    .tone-error {
      color: var(--mat-sys-error);
    }

    .tone-muted {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ScenarioLog {
  readonly lines = input.required<readonly LogLine[]>();

  private readonly panel = viewChild.required<ElementRef<HTMLPreElement>>('panel');

  constructor() {
    // Split across phases so the layout read and the scroll write don't thrash
    // each other, and keyed on the line count so it only runs when a line is
    // actually appended rather than on every render.
    afterRenderEffect({
      earlyRead: () => {
        this.lines().length;
        return this.panel().nativeElement.scrollHeight;
      },
      write: (scrollHeight) => {
        this.panel().nativeElement.scrollTop = scrollHeight();
      },
    });
  }
}
