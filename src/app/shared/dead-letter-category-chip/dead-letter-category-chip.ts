import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DEAD_LETTER_CATEGORY_LABELS, DeadLetterCategory } from '../../core/models';

/**
 * Failure category, spelled out.
 *
 * The wire value is a bare number (`0`/`1` — confirmed against the live API), so
 * showing it raw would be meaningless to an operator. Colour is never the only
 * signal: the label always carries the meaning.
 */
@Component({
  selector: 'app-dead-letter-category-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class.infrastructure]="isInfrastructure()">{{ label() }}</span>`,
  styles: `
    .chip {
      display: inline-block;
      padding: 0.125rem 0.625rem;
      border-radius: 1rem;
      border: 1px solid currentColor;
      color: var(--mat-sys-error);
      font: var(--mat-sys-label-small);
      white-space: nowrap;
    }

    // Infrastructure failures are usually transient; business failures are not.
    .infrastructure {
      color: var(--mat-sys-tertiary);
    }
  `,
})
export class DeadLetterCategoryChip {
  readonly category = input.required<DeadLetterCategory>();

  protected readonly isInfrastructure = computed(
    () => this.category() === DeadLetterCategory.InfrastructureFailure,
  );

  protected readonly label = computed(
    () => DEAD_LETTER_CATEGORY_LABELS[this.category()] ?? `Unknown (${this.category()})`,
  );
}
