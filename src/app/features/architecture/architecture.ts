import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

import {
  AWS_RESOURCES,
  DLQ_PATH,
  ENUMS,
  EVENT_CONTRACT,
  LAMBDAS,
  PATTERNS,
  PIPELINE,
  TABLES,
  TRACING,
} from './architecture.model';

/**
 * Static reference for the system this console drives.
 *
 * Content comes from `TradingApp-AWS/README.md` — see the note in
 * `architecture.model.ts`. No state, no HTTP.
 */
@Component({
  selector: 'app-architecture',
  imports: [MatCardModule, MatExpansionModule, MatIconModule],
  templateUrl: './architecture.html',
  styleUrl: './architecture.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Architecture {
  protected readonly pipeline = PIPELINE;
  protected readonly dlqPath = DLQ_PATH;
  protected readonly lambdas = LAMBDAS;
  protected readonly tables = TABLES;
  protected readonly awsResources = AWS_RESOURCES;
  protected readonly patterns = PATTERNS;
  protected readonly tracing = TRACING;
  protected readonly enums = ENUMS;
  protected readonly eventContract = EVENT_CONTRACT;
}
