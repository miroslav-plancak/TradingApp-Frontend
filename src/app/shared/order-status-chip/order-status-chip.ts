import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { OrderStatus } from '../../core/models';

/**
 * Colour-coded order status.
 *
 * Colour is never the only signal — the status name is always spelled out — so
 * this stays readable for colour-blind operators and in a screen reader.
 */
@Component({
  selector: 'app-order-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="'status-' + status().toLowerCase()">{{ label() }}</span>`,
  styles: `
    .chip {
      display: inline-block;
      padding: 0.125rem 0.625rem;
      border-radius: 1rem;
      border: 1px solid currentColor;
      font: var(--mat-sys-label-small);
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    // Colours are drawn from the theme's system palette so contrast holds in
    // both the light and dark schemes.
    .status-pending_ack {
      color: var(--mat-sys-tertiary);
    }

    .status-acknowledged {
      color: var(--mat-sys-primary);
    }

    .status-filled {
      color: #4ade80;
    }

    .status-rejected {
      color: var(--mat-sys-error);
    }
  `,
})
export class OrderStatusChip {
  readonly status = input.required<OrderStatus>();

  protected readonly label = computed(() => this.status().replace(/_/g, ' '));
}
