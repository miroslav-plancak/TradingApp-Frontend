import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

/**
 * Scaffold-only stand-in for a feature page.
 *
 * Every routed feature renders one of these until its own phase lands, so the
 * shell is navigable end to end from phase 1. Delete the usage (not this
 * component — the later phases keep reusing it) as each feature is built out.
 */
@Component({
  selector: 'app-page-placeholder',
  imports: [MatCardModule, MatChipsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" class="placeholder">
      <mat-card-header>
        <mat-icon mat-card-avatar>{{ icon() }}</mat-icon>
        <mat-card-title>{{ heading() }}</mat-card-title>
        <mat-card-subtitle>{{ phase() }} — not implemented yet</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p class="summary">{{ summary() }}</p>
        @if (planned().length) {
          <h3 class="planned-heading">Planned for this page</h3>
          <mat-chip-set>
            @for (item of planned(); track item) {
              <mat-chip>{{ item }}</mat-chip>
            }
          </mat-chip-set>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .placeholder {
      max-width: 60rem;
    }

    .summary {
      color: var(--mat-sys-on-surface-variant);
      margin-block: 0 1.25rem;
    }

    .planned-heading {
      font: var(--mat-sys-title-small);
      margin-block: 0 0.75rem;
    }
  `,
})
export class PagePlaceholder {
  readonly heading = input.required<string>();
  readonly phase = input.required<string>();
  readonly summary = input.required<string>();
  readonly icon = input('construction');
  readonly planned = input<readonly string[]>([]);
}
