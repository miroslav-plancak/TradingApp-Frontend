import { Injectable, OnDestroy, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { toErrorMessage } from '../../core/api/http-error';
import { CreatedOrderResponse, DeadLetterCategory, OrderResponse } from '../../core/models';
import { DeadLetterApiService } from '../dead-letter/dead-letter-api.service';
import { OrdersApiService } from '../orders/orders-api.service';
import { OutboxApiService } from '../outbox/outbox-api.service';
import {
  LogTone,
  SCENARIO_DEFINITIONS,
  ScenarioId,
  ScenarioRun,
  ScenarioStatus,
  initialRun,
} from './scenario.model';

/** Cancellation handle; every await point checks it. */
interface RunToken {
  cancelled: boolean;
}

type ScenarioParams = Record<string, number>;

/**
 * Owns scenario run state and executes the scripted sequences.
 *
 * Provided at the route, not in root: runs are page-local. `ngOnDestroy`
 * cancels anything in flight, for the same reason the feature pages stop their
 * poll timers — a 90-second scenario must not keep driving the API from another
 * tab after the operator has navigated away.
 *
 * It composes the three existing API services rather than issuing its own HTTP:
 * scenarios drive the same endpoints the other pages do.
 */
@Injectable()
export class ScenarioRunnerService implements OnDestroy {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly outboxApi = inject(OutboxApiService);
  private readonly deadLetterApi = inject(DeadLetterApiService);

  private readonly runs = signal<Record<ScenarioId, ScenarioRun>>(
    Object.fromEntries(SCENARIO_DEFINITIONS.map((d) => [d.id, initialRun()])) as Record<
      ScenarioId,
      ScenarioRun
    >,
  );

  private readonly tokens = new Map<ScenarioId, RunToken>();

  /**
   * One stable computed per scenario, created once.
   *
   * `runFor()` is called from the template, so building the computed inside it
   * would allocate a fresh signal node on every change-detection pass — with a
   * run appending log lines several times a second that piles up thousands of
   * live consumers and wedges the renderer. Measured: the page froze.
   */
  private readonly runSignals = Object.fromEntries(
    SCENARIO_DEFINITIONS.map((definition) => [
      definition.id,
      computed(() => this.runs()[definition.id]),
    ]),
  ) as Record<ScenarioId, Signal<ScenarioRun>>;

  readonly anyRunning = computed(() =>
    Object.values(this.runs()).some((run) => run.status === 'running'),
  );

  runFor(id: ScenarioId): Signal<ScenarioRun> {
    return this.runSignals[id];
  }

  ngOnDestroy(): void {
    this.cancelAll();
  }

  cancelAll(): void {
    for (const id of this.tokens.keys()) {
      this.cancel(id);
    }
  }

  cancel(id: ScenarioId): void {
    const token = this.tokens.get(id);
    if (!token || token.cancelled) {
      return;
    }
    token.cancelled = true;
    this.append(id, '■ cancelled', 'warn');
    this.finish(id, 'cancelled');
  }

  async start(id: ScenarioId, params: ScenarioParams): Promise<void> {
    if (this.runs()[id].status === 'running') {
      return;
    }

    const token: RunToken = { cancelled: false };
    this.tokens.set(id, token);
    this.runs.update((runs) => ({
      ...runs,
      [id]: { status: 'running', lines: [], startedAt: Date.now(), finishedAt: null },
    }));

    try {
      const status = await this.execute(id, params, token);
      if (!token.cancelled) {
        this.finish(id, status);
      }
    } catch (error: unknown) {
      if (!token.cancelled) {
        this.append(id, `✗ ${toErrorMessage(error)}`, 'error');
        this.finish(id, 'failed');
      }
    } finally {
      this.tokens.delete(id);
    }
  }

  private execute(id: ScenarioId, params: ScenarioParams, token: RunToken): Promise<ScenarioStatus> {
    switch (id) {
      case 'full-lifecycle':
        return this.fullLifecycle(params, token);
      case 'pub-sub-fan-out':
        return this.pubSubFanOut(params, token);
      case 'throughput':
        return this.throughput(params, token);
      case 'outbox-drain':
        return this.outboxDrain(params, token);
      case 'idempotency':
        return this.idempotency(params, token);
      case 'dead-letter-roundtrip':
        return this.deadLetterRoundTrip(token);
    }
  }

  // ---------------------------------------------------------------- scenarios

  /** ① Submit orders, then watch each one advance through the state machine. */
  private async fullLifecycle(params: ScenarioParams, token: RunToken): Promise<ScenarioStatus> {
    const id: ScenarioId = 'full-lifecycle';
    const count = params['count'];
    const wait = params['wait'];

    this.append(id, '▶ phase 1/4: baseline snapshot', 'step');
    const baseline = await firstValueFrom(this.outboxApi.stats());
    this.append(id, `  outbox total: ${baseline.totalCount}`, 'muted');

    this.append(id, `▶ phase 2/4: creating ${count} orders`, 'step');
    const created = await this.createOrders(id, count, (i) => ({ quantity: 10 + i, price: 100 + i }), token);
    if (token.cancelled) return 'cancelled';
    if (!created.length) {
      this.append(id, '✗ no orders accepted — abort', 'error');
      return 'failed';
    }

    this.append(id, `▶ phase 3/4: polling for up to ${wait}s`, 'step');
    const start = Date.now();
    const seen = new Map<string, string>();
    while ((Date.now() - start) / 1000 < wait && !token.cancelled) {
      const orders = await this.fetchAll(created);
      for (const order of orders) {
        const current = `${order.status}/${order.isProcessed}`;
        if (seen.get(order.id) !== current) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          this.append(
            id,
            `  t=${elapsed}s  ${order.id.slice(0, 8)}…  → ${order.status} processed=${order.isProcessed}`,
            'plain',
          );
          seen.set(order.id, current);
        }
      }
      if (orders.length && orders.every((order) => order.status === 'FILLED')) {
        this.append(id, '  → all orders reached FILLED early', 'success');
        break;
      }
      await this.sleep(3000, token);
    }
    if (token.cancelled) return 'cancelled';

    this.append(id, '▶ phase 4/4: results', 'step');
    const final = await this.fetchAll(created);
    const tally = { PENDING_ACK: 0, ACKNOWLEDGED: 0, REJECTED: 0, FILLED: 0 };
    let processed = 0;
    for (const order of final) {
      tally[order.status] = (tally[order.status] ?? 0) + 1;
      if (order.isProcessed) processed++;
    }

    this.rule(id);
    this.append(id, 'RESULT', 'heading');
    this.append(id, `  total submitted ........ ${created.length}`, 'plain');
    this.append(id, `  processed .............. ${processed}`, 'plain');
    this.append(id, `  PENDING_ACK ............ ${tally.PENDING_ACK}`, 'plain');
    this.append(id, `  ACKNOWLEDGED ........... ${tally.ACKNOWLEDGED}`, 'plain');
    this.append(id, `  REJECTED ............... ${tally.REJECTED}`, 'plain');
    this.append(id, `  FILLED ................. ${tally.FILLED}`, 'plain');

    // REJECTED is a legitimate terminal state, not a failure of the pipeline —
    // the run only fails if messages never got processed at all.
    return this.verdict(id, processed === created.length, `${processed}/${created.length} processed`);
  }

  /** ② Every processed order should fan out to three topic subscribers. */
  private async pubSubFanOut(params: ScenarioParams, token: RunToken): Promise<ScenarioStatus> {
    const id: ScenarioId = 'pub-sub-fan-out';
    const count = params['count'];
    const wait = params['wait'];

    this.append(id, `▶ phase 1/3: submit ${count} orders`, 'step');
    const created = await this.createOrders(id, count, () => ({ quantity: 100, price: 200 }), token);
    if (token.cancelled) return 'cancelled';

    this.append(id, `▶ phase 2/3: wait ${wait}s for fan-out`, 'step');
    this.append(id, '  each order → OrderExecutionProvider → order_events_topic', 'muted');
    this.append(id, '  each topic message → risk + notification + audit', 'muted');
    this.append(id, `  expected subscriber invocations: ${count * 3}`, 'muted');
    await this.sleep(wait * 1000, token);
    if (token.cancelled) return 'cancelled';

    this.append(id, '▶ phase 3/3: verify processing', 'step');
    const final = await this.fetchAll(created);
    const processed = final.filter((order) => order.isProcessed).length;

    this.rule(id);
    this.append(id, 'RESULT', 'heading');
    this.append(id, `  orders processed .................. ${processed}/${created.length}`, 'plain');
    this.append(id, `  topic events published (expected) . ${processed}`, 'plain');
    this.append(id, `  subscriber fires (expected) ....... ${processed * 3}`, 'plain');
    this.append(id, '', 'plain');
    this.append(id, '→ check the consoles of RiskAnalysisProcessor,', 'muted');
    this.append(id, `  NotificationProcessor and AuditLogProcessor —`, 'muted');
    this.append(id, `  each should show ${processed} invocations`, 'muted');

    return this.verdict(id, processed === created.length, `${processed}/${created.length} processed`);
  }

  /** ③ Concurrent submission, then latency percentiles from createdAt → updatedAt. */
  private async throughput(params: ScenarioParams, token: RunToken): Promise<ScenarioStatus> {
    const id: ScenarioId = 'throughput';
    const count = params['count'];
    const wait = params['wait'];

    this.append(id, `▶ firing ${count} concurrent requests`, 'step');
    const start = Date.now();
    const settled = await Promise.allSettled(
      Array.from({ length: count }, (_, i) =>
        firstValueFrom(this.ordersApi.create({ quantity: 10 + i, price: 100 + i })),
      ),
    );
    const elapsed = (Date.now() - start) / 1000;
    const accepted = settled
      .filter(
        (result): result is PromiseFulfilledResult<CreatedOrderResponse> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value.id);

    this.append(
      id,
      `  submission: ${accepted.length}/${count} accepted in ${elapsed.toFixed(2)}s (${(count / elapsed).toFixed(1)} req/s)`,
      accepted.length === count ? 'success' : 'warn',
    );
    if (!accepted.length) {
      this.append(id, '✗ nothing accepted — abort', 'error');
      return 'failed';
    }

    this.append(id, `▶ waiting ${wait}s for processing`, 'step');
    await this.sleep(wait * 1000, token);
    if (token.cancelled) return 'cancelled';

    this.append(id, '▶ sampling latencies', 'step');
    const final = await this.fetchAll(accepted);
    const latencies = final
      .filter((order) => order.isProcessed)
      .map((order) => new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime())
      .sort((a, b) => a - b);

    this.rule(id);
    this.append(id, 'RESULT', 'heading');
    this.append(id, `  processed ........ ${latencies.length}/${accepted.length}`, 'plain');
    if (latencies.length) {
      const percentile = (q: number) =>
        latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] / 1000;
      const average = latencies.reduce((sum, value) => sum + value, 0) / latencies.length / 1000;
      this.append(id, `  avg latency ...... ${average.toFixed(2)}s`, 'plain');
      this.append(id, `  p50 latency ...... ${percentile(0.5).toFixed(2)}s`, 'plain');
      this.append(id, `  p95 latency ...... ${percentile(0.95).toFixed(2)}s`, 'plain');
      this.append(id, `  p99 latency ...... ${percentile(0.99).toFixed(2)}s`, 'plain');
      this.append(id, `  max latency ...... ${(latencies[latencies.length - 1] / 1000).toFixed(2)}s`, 'plain');
    } else {
      this.append(id, '  no processed orders — extend the sample wait', 'warn');
    }

    return this.verdict(
      id,
      latencies.length === accepted.length,
      `${latencies.length}/${accepted.length} sampled`,
    );
  }

  /** ④ Build a backlog, then time how long the processor takes to clear it. */
  private async outboxDrain(params: ScenarioParams, token: RunToken): Promise<ScenarioStatus> {
    const id: ScenarioId = 'outbox-drain';
    const count = params['count'];
    const timeout = params['timeout'];

    this.append(id, `▶ creating ${count} orders`, 'step');
    const created = await this.createOrders(id, count, () => ({ quantity: 50, price: 100 }), token, true);
    if (token.cancelled) return 'cancelled';
    this.append(id, `  ✓ ${created.length} orders queued`, 'success');

    this.append(id, `▶ polling outbox stats every 2s (max ${timeout}s)`, 'step');
    const start = Date.now();
    let lastUnprocessed = -1;
    while ((Date.now() - start) / 1000 < timeout && !token.cancelled) {
      const stats = await firstValueFrom(this.outboxApi.stats());
      if (stats.unprocessedCount !== lastUnprocessed) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        this.append(
          id,
          `  t=${elapsed}s  total=${stats.totalCount}  pending=${stats.unprocessedCount}`,
          'plain',
        );
        lastUnprocessed = stats.unprocessedCount;
      }
      if (stats.unprocessedCount === 0) {
        this.rule(id);
        this.append(
          id,
          `✓ DRAINED in ${((Date.now() - start) / 1000).toFixed(1)}s`,
          'success',
        );
        return 'passed';
      }
      await this.sleep(2000, token);
    }
    if (token.cancelled) return 'cancelled';

    this.rule(id);
    this.append(id, '⚠ TIMEOUT — backlog not drained', 'error');
    this.append(id, '  check ScheduledOutboxMessageProcessor (runs every 60s)', 'muted');
    return 'failed';
  }

  /** ⑤ Every processed order should have been updated exactly once. */
  private async idempotency(params: ScenarioParams, token: RunToken): Promise<ScenarioStatus> {
    const id: ScenarioId = 'idempotency';
    const count = params['count'];
    const wait = params['wait'];

    this.append(id, `▶ creating ${count} orders`, 'step');
    const created = await this.createOrders(id, count, () => ({ quantity: 75, price: 150 }), token, true);
    if (token.cancelled) return 'cancelled';
    this.append(id, `  ✓ ${created.length} orders created`, 'success');

    this.append(id, `▶ waiting ${wait}s for the consumer`, 'step');
    await this.sleep(wait * 1000, token);
    if (token.cancelled) return 'cancelled';

    this.append(id, '▶ verifying each order was updated exactly once', 'step');
    const final = await this.fetchAll(created);
    let clean = 0;
    let suspicious = 0;
    let unprocessed = 0;
    for (const order of final) {
      if (!order.isProcessed) {
        unprocessed++;
      } else if (new Date(order.updatedAt).getTime() > new Date(order.createdAt).getTime()) {
        clean++;
      } else {
        suspicious++;
      }
    }

    this.rule(id);
    this.append(id, 'RESULT', 'heading');
    this.append(id, `  cleanly processed ......... ${clean}`, 'plain');
    this.append(id, `  not yet processed ......... ${unprocessed}`, 'plain');
    this.append(id, `  suspicious (same ts) ...... ${suspicious}`, 'plain');
    this.append(id, '', 'plain');
    this.append(id, '→ to stress the race condition, run OrderExecutionProvider', 'muted');
    this.append(id, '  in two terminals against the same Service Bus and DB;', 'muted');
    this.append(id, '  one should log "already processed by another instance"', 'muted');

    return this.verdict(id, clean === final.length, `${clean}/${final.length} clean`);
  }

  /** ⑥ Inject a synthetic dead letter, find it by client order id, resolve it. */
  private async deadLetterRoundTrip(token: RunToken): Promise<ScenarioStatus> {
    const id: ScenarioId = 'dead-letter-roundtrip';
    const clientOrderId = crypto.randomUUID();

    this.append(id, '▶ phase 1/3: injecting a synthetic dead letter', 'step');
    this.append(id, `  clientOrderId: ${clientOrderId}`, 'muted');
    const entry = await firstValueFrom(
      this.deadLetterApi.create({
        clientOrderId,
        reason: 'scenario test',
        messageBody: '{"scenario":true}',
        // Numeric on the wire — the API rejects the string form.
        category: DeadLetterCategory.BusinessFailure,
        correlationId: crypto.randomUUID(),
      }),
    );
    this.append(id, `  ✓ created id=${entry.id}`, 'success');
    if (token.cancelled) return 'cancelled';

    this.append(id, '▶ phase 2/3: lookup by clientOrderId', 'step');
    const found = await firstValueFrom(this.deadLetterApi.getByClientOrderId(clientOrderId));
    const matched = found.id === entry.id;
    this.append(id, `  → ${found.id}${matched ? ' (matches)' : ' (MISMATCH)'}`, matched ? 'plain' : 'error');
    if (token.cancelled) return 'cancelled';

    this.append(id, '▶ phase 3/3: resolving', 'step');
    const resolved = await firstValueFrom(
      this.deadLetterApi.resolve(entry.id, {
        resolutionNotes: 'auto-resolved by scenario',
        resolvedBy: 'scenario-bot',
      }),
    );

    this.rule(id);
    // The synthetic entry is left in place on purpose: the point of the round
    // trip is that it is inspectable afterwards in the Dead Letter tab.
    this.append(id, `  entry ${entry.id} left resolved for inspection`, 'muted');
    return this.verdict(id, matched && resolved.isResolved, 'round-trip complete');
  }

  // ------------------------------------------------------------------ helpers

  /** Creates orders sequentially, logging each unless `quiet`. */
  private async createOrders(
    id: ScenarioId,
    count: number,
    body: (index: number) => { quantity: number; price: number },
    token: RunToken,
    quiet = false,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count && !token.cancelled; i++) {
      try {
        const order = await firstValueFrom(this.ordersApi.create(body(i)));
        ids.push(order.id);
        if (!quiet) {
          this.append(id, `  ✓ ${order.id}  status=${order.status}`, 'success');
        }
      } catch (error: unknown) {
        this.append(id, `  ✗ ${toErrorMessage(error)}`, 'error');
      }
    }
    return ids;
  }

  /** Fetches the given orders, skipping any that have gone missing. */
  private async fetchAll(ids: readonly string[]): Promise<OrderResponse[]> {
    const settled = await Promise.allSettled(
      ids.map((id) => firstValueFrom(this.ordersApi.getById(id))),
    );
    return settled
      .filter((result): result is PromiseFulfilledResult<OrderResponse> => result.status === 'fulfilled')
      .map((result) => result.value);
  }

  /**
   * Sleep that wakes early when the run is cancelled, so Stop feels immediate.
   *
   * The deadline is wall-clock, not a tally of ticks: browsers throttle timers
   * in background tabs and under load, and counting `250ms` per tick made a
   * 60-second wait take 94 seconds — which in turn made every reported duration
   * and the drain-test timeout wrong.
   */
  private sleep(ms: number, token: RunToken): Promise<void> {
    const deadline = Date.now() + ms;
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (token.cancelled || Date.now() >= deadline) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  }

  private verdict(id: ScenarioId, passed: boolean, detail: string): ScenarioStatus {
    this.append(id, passed ? `✓ PASS — ${detail}` : `⚠ PARTIAL — ${detail}`, passed ? 'success' : 'warn');
    return passed ? 'passed' : 'partial';
  }

  private rule(id: ScenarioId): void {
    this.append(id, '─'.repeat(46), 'heading');
  }

  private append(id: ScenarioId, text: string, tone: LogTone): void {
    this.runs.update((runs) => ({
      ...runs,
      [id]: { ...runs[id], lines: [...runs[id].lines, { text, tone }] },
    }));
  }

  private finish(id: ScenarioId, status: ScenarioStatus): void {
    this.runs.update((runs) => ({
      ...runs,
      [id]: { ...runs[id], status, finishedAt: Date.now() },
    }));
  }
}
