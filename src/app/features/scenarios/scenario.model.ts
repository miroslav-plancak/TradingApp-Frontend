/**
 * Scenario types.
 *
 * Deliberately NOT an `@ngrx/entity` slice — see PROGRESS.md. A scenario run is
 * a page-local, long-running process with an append-only log, not shared
 * application state, and it reads far better as sequential async code than as a
 * chain of effects.
 */

export type ScenarioId =
  | 'full-lifecycle'
  | 'pub-sub-fan-out'
  | 'throughput'
  | 'outbox-drain'
  | 'idempotency'
  | 'dead-letter-roundtrip';

export type ScenarioStatus = 'idle' | 'running' | 'passed' | 'partial' | 'failed' | 'cancelled';

export type LogTone = 'plain' | 'step' | 'success' | 'error' | 'warn' | 'muted' | 'heading';

export interface LogLine {
  text: string;
  tone: LogTone;
}

export interface ScenarioParam {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  /** Shown under the field; usually the unit. */
  hint?: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  /** The ①–⑥ numbering from the original console. */
  index: number;
  title: string;
  tagline: string;
  description: string;
  params: readonly ScenarioParam[];
}

export interface ScenarioRun {
  status: ScenarioStatus;
  lines: LogLine[];
  startedAt: number | null;
  finishedAt: number | null;
}

export const SCENARIO_DEFINITIONS: readonly ScenarioDefinition[] = [
  {
    id: 'full-lifecycle',
    index: 1,
    title: 'Full order lifecycle',
    tagline: 'PENDING_ACK → ACKNOWLEDGED → FILLED',
    description:
      'Submits orders and watches the state machine advance. Validates API → DB → Outbox → Service Bus → consumer → status update.',
    params: [
      { key: 'count', label: 'Order count', value: 5, min: 1, max: 100 },
      { key: 'wait', label: 'Total wait', value: 90, min: 5, max: 600, hint: 'seconds' },
    ],
  },
  {
    id: 'pub-sub-fan-out',
    index: 2,
    title: 'Pub-sub fan-out',
    tagline: 'Topic broadcast verification',
    description:
      'Submits orders and verifies fan-out across order_events_topic. Each processed order should trigger three subscribers: risk, notifications, audit.',
    params: [
      { key: 'count', label: 'Order count', value: 3, min: 1, max: 50 },
      { key: 'wait', label: 'Wait', value: 20, min: 5, max: 300, hint: 'seconds' },
    ],
  },
  {
    id: 'throughput',
    index: 3,
    title: 'Throughput benchmark',
    tagline: 'p50 / p95 / p99 latency',
    description:
      'Fires N requests concurrently, then samples end-to-end latency (createdAt → updatedAt) and reports percentiles.',
    params: [
      { key: 'count', label: 'Parallel orders', value: 30, min: 1, max: 200 },
      { key: 'wait', label: 'Sample wait', value: 30, min: 5, max: 300, hint: 'seconds' },
    ],
  },
  {
    id: 'outbox-drain',
    index: 4,
    title: 'Outbox drain test',
    tagline: 'Backlog processing rate',
    description:
      'Creates a backlog, then polls outbox stats until it drains. Measures how fast ScheduledOutboxMessageProcessor clears it.',
    params: [
      { key: 'count', label: 'Order count', value: 20, min: 1, max: 200 },
      { key: 'timeout', label: 'Timeout', value: 180, min: 10, max: 900, hint: 'seconds' },
    ],
  },
  {
    id: 'idempotency',
    index: 5,
    title: 'Idempotency probe',
    tagline: 'Atomic UPDATE verification',
    description:
      'Checks that the atomic ExecuteUpdateAsync with WHERE IsProcessed = 0 prevents double-processing.',
    params: [
      { key: 'count', label: 'Probe count', value: 10, min: 1, max: 100 },
      { key: 'wait', label: 'Wait', value: 15, min: 5, max: 300, hint: 'seconds' },
    ],
  },
  {
    id: 'dead-letter-roundtrip',
    index: 6,
    title: 'Dead letter round-trip',
    tagline: 'DLQ API surface validation',
    description:
      'Injects a synthetic dead letter, fetches it by client order id, then resolves it. Exercises the dead letter controller end to end.',
    params: [],
  },
];

export function initialRun(): ScenarioRun {
  return { status: 'idle', lines: [], startedAt: null, finishedAt: null };
}
