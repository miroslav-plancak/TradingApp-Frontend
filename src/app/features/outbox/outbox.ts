import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

@Component({
  selector: 'app-outbox',
  imports: [PagePlaceholder],
  templateUrl: './outbox.html',
  styleUrl: './outbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Outbox {
  protected readonly planned = [
    'Message list (@ngrx/entity)',
    'All / unprocessed / processed filters',
    'Stats summary',
    'Mark processed',
    'Delete one / delete all',
    'Auto-refresh toggle',
  ];
}
