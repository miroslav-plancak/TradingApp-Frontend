import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

@Component({
  selector: 'app-orders',
  imports: [PagePlaceholder],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Orders {
  protected readonly planned = [
    'Order list (@ngrx/entity)',
    'Create order form',
    'Lookup by id',
    'Delete one / delete all',
    'Auto-refresh toggle',
  ];
}
