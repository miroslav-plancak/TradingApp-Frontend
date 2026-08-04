import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { toErrorMessage } from '../../core/api/http-error';
import { OrdersApiService } from '../orders/orders-api.service';
import { LogLine } from './scenario.model';

export interface BurstSettings {
  count: number;
  /** Delay between submissions, in ms. */
  delay: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface BurstState {
  running: boolean;
  sent: number;
  success: number;
  failed: number;
  startedAt: number | null;
  lines: LogLine[];
}

const INITIAL: BurstState = {
  running: false,
  sent: 0,
  success: 0,
  failed: 0,
  startedAt: null,
  lines: [],
};

/**
 * Load generator: submits N orders spaced by a delay.
 *
 * Paced rather than fired all at once — that is the point of the delay knob, and
 * it is what keeps this from becoming an accidental denial of service against a
 * local Kestrel. The throughput scenario is the one that fires concurrently.
 */
@Injectable()
export class BurstRunnerService implements OnDestroy {
  private readonly ordersApi = inject(OrdersApiService);

  private readonly stateSignal = signal<BurstState>(INITIAL);
  private cancelled = false;

  readonly state = this.stateSignal.asReadonly();

  /** Submissions per second so far — the headline number during a run. */
  readonly rate = computed(() => {
    const { sent, startedAt } = this.stateSignal();
    if (!startedAt) {
      return 0;
    }
    const elapsed = (Date.now() - startedAt) / 1000;
    return elapsed > 0 ? sent / elapsed : 0;
  });

  ngOnDestroy(): void {
    this.stop();
  }

  stop(): void {
    if (this.stateSignal().running) {
      this.cancelled = true;
    }
  }

  async start(settings: BurstSettings): Promise<void> {
    if (this.stateSignal().running) {
      return;
    }

    this.cancelled = false;
    this.stateSignal.set({ ...INITIAL, running: true, startedAt: Date.now() });
    this.append(`▶ burst init: ${settings.count} orders @ ${settings.delay}ms`, 'step');

    for (let i = 1; i <= settings.count && !this.cancelled; i++) {
      const quantity =
        Math.floor(Math.random() * (settings.maxQuantity - settings.minQuantity + 1)) +
        settings.minQuantity;
      const price = Number((Math.random() * 500 + 50).toFixed(2));

      this.stateSignal.update((state) => ({ ...state, sent: state.sent + 1 }));

      try {
        const order = await firstValueFrom(this.ordersApi.create({ quantity, price }));
        this.stateSignal.update((state) => ({ ...state, success: state.success + 1 }));
        this.append(`✓ #${i}: qty=${quantity} px=${price} → ${order.clientOrderId}`, 'success');
      } catch (error: unknown) {
        this.stateSignal.update((state) => ({ ...state, failed: state.failed + 1 }));
        this.append(`✗ #${i}: ${toErrorMessage(error)}`, 'error');
      }

      if (settings.delay > 0 && i < settings.count) {
        await this.pause(settings.delay);
      }
    }

    const { success, failed } = this.stateSignal();
    if (this.cancelled) {
      this.append(`■ stopped: ${success} success / ${failed} failed`, 'warn');
    } else {
      this.append(
        `✓ burst complete: ${success} success / ${failed} failed`,
        failed === 0 ? 'success' : 'warn',
      );
    }
    this.stateSignal.update((state) => ({ ...state, running: false }));
  }

  /** Wall-clock deadline, not a tally of ticks — see `ScenarioRunnerService.sleep`. */
  private pause(ms: number): Promise<void> {
    const deadline = Date.now() + ms;
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (this.cancelled || Date.now() >= deadline) {
          clearInterval(timer);
          resolve();
        }
      }, Math.min(ms, 100));
    });
  }

  private append(text: string, tone: LogLine['tone']): void {
    this.stateSignal.update((state) => ({ ...state, lines: [...state.lines, { text, tone }] }));
  }
}
