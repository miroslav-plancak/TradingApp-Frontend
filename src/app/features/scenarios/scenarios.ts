import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

@Component({
  selector: 'app-scenarios',
  imports: [PagePlaceholder],
  templateUrl: './scenarios.html',
  styleUrl: './scenarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Scenarios {
  protected readonly planned = [
    '6 canned integration-test runners',
    'Burst load test',
    'Per-scenario run state + output log',
    'Purge database utility',
  ];
}
