import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

@Component({
  selector: 'app-architecture',
  imports: [PagePlaceholder],
  templateUrl: './architecture.html',
  styleUrl: './architecture.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Architecture {
  protected readonly planned = [
    'Pipeline diagram',
    'Component reference (API, functions, queues, tables)',
    'Event flow walkthrough',
  ];
}
