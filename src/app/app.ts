import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ApiConfigService } from './core/config/api-config.service';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly apiConfig = inject(ApiConfigService);

  /** Mirrors the five tabs of the original single-file console. */
  protected readonly navLinks: readonly NavLink[] = [
    { path: '/orders', label: 'Orders', icon: 'receipt_long' },
    { path: '/outbox', label: 'Outbox', icon: 'outbox' },
    { path: '/dead-letter', label: 'Dead Letter', icon: 'report' },
    { path: '/scenarios', label: 'Scenarios', icon: 'science' },
    { path: '/architecture', label: 'Architecture', icon: 'account_tree' },
  ];

  /** Committed on blur/Enter rather than per keystroke, so normalization can't fight typing. */
  protected onBaseUrlCommit(event: Event): void {
    this.apiConfig.setBaseUrl((event.target as HTMLInputElement).value);
  }
}
