import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

@Component({
  selector: 'app-dead-letter',
  imports: [PagePlaceholder],
  templateUrl: './dead-letter.html',
  styleUrl: './dead-letter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadLetter {
  protected readonly planned = [
    'Log list (@ngrx/entity)',
    'All / unresolved filters',
    'Stats summary',
    'Lookup by id / by client order id',
    'Resolve dialog',
    'Manual inject form (testing)',
    'Delete one / delete all',
    'Auto-refresh toggle',
  ];
}
