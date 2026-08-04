/**
 * Content for the Architecture page.
 *
 * Single source: `TradingApp-AWS/README.md`, which was rewritten for the AWS
 * port. It is deliberately NOT derived from the original console's
 * architecture tab (that still described the Azure/Service Bus original) and
 * not re-derived from `Functions/*` by hand.
 *
 * When the backend changes, update the README first and mirror it here.
 */

export interface PipelineStage {
  /** Short label for the box in the flow. */
  name: string;
  kind: string;
  detail: string;
  /** Rendered as a branch under the stage rather than a sequential step. */
  fanOut?: readonly string[];
}

export interface LambdaFunction {
  name: string;
  trigger: string;
  responsibility: string;
  /** Stub implementations are called out so nobody trusts them in a test. */
  stub?: boolean;
}

export interface DatabaseTable {
  name: string;
  purpose: string;
}

export interface AwsResource {
  name: string;
  type: string;
  notes: string;
}

export interface Pattern {
  title: string;
  summary: string;
  points: readonly string[];
}

export const PIPELINE: readonly PipelineStage[] = [
  {
    name: 'POST /api/order',
    kind: 'TradingApp.API · ASP.NET Core',
    detail:
      'Inserts the Order and its OutboxMessage atomically in one SQL transaction. The outbox is the only path to SQS — nothing publishes directly from the API.',
  },
  {
    name: 'ScheduledOutboxMessageProcessor',
    kind: 'Lambda · EventBridge Scheduler, every 1 min',
    detail:
      'Three phases per cycle: quarantine messages that exhausted 5 retries, claim and dispatch pending messages (Polly retry + circuit breaker), then auto-recover quarantined messages once SQS is healthy.',
  },
  {
    name: 'CREATE_ORDER_QUEUE.fifo',
    kind: 'Amazon SQS · FIFO',
    detail:
      'MessageGroupId = ClientOrderId. CorrelationId travels as a message attribute. Redrives to CREATE_ORDER_QUEUE-DLQ.fifo past the max receive count.',
  },
  {
    name: 'OrderExecutionProcessor',
    kind: 'Lambda · SQS trigger',
    detail:
      'Idempotent via ExecuteUpdateAsync with WHERE !IsProcessed — a duplicate updates zero rows and exits. Assigns ACKNOWLEDGED or REJECTED, then publishes OrderProcessed with Sequence 1.',
  },
  {
    name: 'order_events_topic.fifo',
    kind: 'Amazon SNS · FIFO',
    detail:
      'MessageGroupId = ClientOrderId; CorrelationId is embedded in the OrderStatusEvent payload rather than in message attributes. Fans out to three subscriber queues.',
    fanOut: [
      'notification_queue.fifo → NotificationProcessor',
      'risk_analysis_queue.fifo → RiskAnalysisProcessor',
      'audit_log_queue.fifo → AuditLogProcessor',
    ],
  },
  {
    name: 'ScheduledOrderStatusProcessor',
    kind: 'Lambda · EventBridge Scheduler, every 1 min',
    detail:
      'Promotes ACKNOWLEDGED to FILLED, 50 orders per cycle, and publishes OrderStatusFilled with Sequence 2. Falls back to UnpublishedTopicMessages when the publish fails.',
  },
  {
    name: 'ScheduledUnpublishedTopicMessagesProcessor',
    kind: 'Lambda · EventBridge Scheduler, every 1 min',
    detail:
      'Retries failed topic publishes, with the same claim/lease guard and circuit breaker as the outbox processor.',
  },
];

export const DLQ_PATH: readonly PipelineStage[] = [
  {
    name: 'CREATE_ORDER_QUEUE-DLQ.fifo',
    kind: 'Amazon SQS · FIFO',
    detail: 'Redrive target once a message exceeds the max receive count on the main queue.',
  },
  {
    name: 'DeadLetterQueueProcessor',
    kind: 'Lambda · SQS trigger',
    detail:
      'Persists the dead-lettered message to DeadLetterLogs and raises a Teams alert. This is what the Dead Letter tab reads.',
  },
];

export const LAMBDAS: readonly LambdaFunction[] = [
  {
    name: 'OrderExecutionProcessor',
    trigger: 'SQS: CREATE_ORDER_QUEUE.fifo',
    responsibility:
      'Idempotent order processing; publishes OrderProcessed (Sequence 1) to order_events_topic.fifo',
  },
  {
    name: 'ScheduledOutboxMessageProcessor',
    trigger: 'EventBridge Scheduler: every 1 min',
    responsibility:
      'Three-phase: quarantine exhausted → claim and dispatch pending → auto-recover resurrected',
  },
  {
    name: 'ScheduledUnpublishedTopicMessagesProcessor',
    trigger: 'EventBridge Scheduler: every 1 min',
    responsibility:
      'Retries failed topic publishes from UnpublishedTopicMessages; claim/lease guarded, Polly retry + circuit breaker',
  },
  {
    name: 'ScheduledOrderStatusProcessor',
    trigger: 'EventBridge Scheduler: every 1 min',
    responsibility:
      'Promotes ACKNOWLEDGED → FILLED (50 per cycle); publishes OrderStatusFilled (Sequence 2)',
  },
  {
    name: 'DeadLetterQueueProcessor',
    trigger: 'SQS: CREATE_ORDER_QUEUE-DLQ.fifo',
    responsibility: 'Persists dead-lettered messages to DeadLetterLogs; Teams webhook alert',
  },
  {
    name: 'NotificationProcessor',
    trigger: 'SQS: notification_queue.fifo',
    responsibility: 'Sequence-ordered delivery (ACKNOWLEDGED before FILLED); Teams webhook',
  },
  {
    name: 'RiskAnalysisProcessor',
    trigger: 'SQS: risk_analysis_queue.fifo',
    responsibility: 'Receives OrderProcessed / OrderStatusFilled events for risk scoring',
    stub: true,
  },
  {
    name: 'AuditLogProcessor',
    trigger: 'SQS: audit_log_queue.fifo',
    responsibility: 'Receives events for audit logging',
    stub: true,
  },
];

export const TABLES: readonly DatabaseTable[] = [
  {
    name: 'Orders',
    purpose:
      'Core order records. ClientOrderId is the unique business key; IsProcessed guards idempotency.',
  },
  {
    name: 'OutboxMessages',
    purpose:
      'Transactional outbox. Written atomically with Orders, dispatched to SQS by the timer processor.',
  },
  {
    name: 'QuarantinedOutboxMessages',
    purpose: 'Messages that exhausted 5 retries. Auto-resurrected once SQS is healthy again.',
  },
  {
    name: 'UnpublishedTopicMessages',
    purpose:
      'Failed order_events_topic.fifo publishes, retried by a dedicated scheduled processor.',
  },
  {
    name: 'DeadLetterLogs',
    purpose: 'Dead-lettered messages persisted from CREATE_ORDER_QUEUE-DLQ.fifo.',
  },
  {
    name: 'OrderNotificationSequences',
    purpose:
      'Last processed sequence number per order, enforcing ACKNOWLEDGED-before-FILLED ordering.',
  },
  {
    name: 'PendingFilledNotifications',
    purpose:
      'Out-of-order FILLED events, persisted so they survive restarts and replay once ACKNOWLEDGED lands.',
  },
];

export const AWS_RESOURCES: readonly AwsResource[] = [
  {
    name: 'CREATE_ORDER_QUEUE.fifo',
    type: 'SQS queue',
    notes: 'MessageGroupId = ClientOrderId',
  },
  {
    name: 'CREATE_ORDER_QUEUE-DLQ.fifo',
    type: 'SQS queue',
    notes: 'Redrive target after max receive count',
  },
  {
    name: 'order_events_topic.fifo',
    type: 'SNS topic',
    notes: 'MessageGroupId = ClientOrderId',
  },
  {
    name: 'notification_queue.fifo',
    type: 'SQS queue',
    notes: 'Subscribed to order_events_topic.fifo',
  },
  {
    name: 'risk_analysis_queue.fifo',
    type: 'SQS queue',
    notes: 'Subscribed to order_events_topic.fifo',
  },
  {
    name: 'audit_log_queue.fifo',
    type: 'SQS queue',
    notes: 'Subscribed to order_events_topic.fifo',
  },
];

export const PATTERNS: readonly Pattern[] = [
  {
    title: 'Transactional outbox',
    summary: 'One SQL transaction writes the order and the message that announces it.',
    points: [
      'POST /api/order inserts an Order and an OutboxMessage atomically.',
      'The outbox is the only path to SQS — nothing publishes directly from the API.',
      'A failed publish therefore never leaves an order that the rest of the system never hears about.',
    ],
  },
  {
    title: 'Idempotent processing',
    summary: 'The update itself is the guard, not a prior read.',
    points: [
      'OrderExecutionProcessor uses ExecuteUpdateAsync with a WHERE !IsProcessed clause.',
      'A duplicate delivery updates zero rows and exits cleanly, with no double-publish.',
      'The Idempotency probe scenario checks this end to end.',
    ],
  },
  {
    title: 'Claim / lease (ClaimedBy, ClaimedAt)',
    summary: 'Timer-triggered Lambdas can overlap; a claimed row is skipped, not reprocessed.',
    points: [
      'The two scheduled processors run on EventBridge Scheduler, so a slow run can overlap the next.',
      'Each atomically claims a row before acting: WHERE ClaimedBy IS NULL OR ClaimedAt < now - LEASE_SECONDS, setting ClaimedBy to the AWS request id.',
      'Every Lambda timeout comfortably exceeds its own LEASE_SECONDS, so a lease cannot expire under a still-running invocation.',
    ],
  },
  {
    title: 'Resilience policies (Polly)',
    summary: 'Two independently circuited policies per Lambda, so SQL and messaging fail separately.',
    points: [
      'Registered through AddResiliencePolicy and keyed by ResiliencePolicyKey — Sql or Messaging.',
      'Each wraps a 3-attempt exponential backoff retry inside a circuit breaker: opens after 3 consecutive failures, 2-minute cooldown.',
      'Transience is judged per domain — AWS service exceptions and known-transient SQL Server error numbers — with a shared HTTP-level fallback.',
      'A downed SQL Server therefore cannot trip the breaker guarding SNS and SQS calls.',
    ],
  },
  {
    title: 'SQS partial batch failure reporting',
    summary: 'One bad record no longer forces redelivery of the whole batch.',
    points: [
      'All five SQS-triggered Lambdas return SQSBatchResponse via the shared SqsBatchHandler.',
      'Each record is processed in its own try/catch and only failed MessageIds are reported in BatchItemFailures.',
      'This fixed a real bug: a redelivered ACKNOWLEDGED message resent a live Teams notification purely because an unrelated order failed in the same batch.',
      'Each event source mapping must have FunctionResponseTypes: ["ReportBatchItemFailures"] set — a mapping-level setting no code change can turn on.',
    ],
  },
  {
    title: 'Quarantine and auto-recovery',
    summary: 'Exhausted messages are parked, then resurrected rather than dropped.',
    points: [
      'Five failed dispatch attempts move a message from OutboxMessages to QuarantinedOutboxMessages.',
      'AutoRecoverResurrectedMessages resurrects them once SQS is reachable, resetting the retry count and clearing ProcessedAt.',
      'They re-enter the normal dispatch pipeline on the next cycle.',
    ],
  },
  {
    title: 'Unpublished topic message fallback',
    summary: 'A failed SNS publish is saved with the status it had at the time.',
    points: [
      'When either publisher cannot reach order_events_topic.fifo, the event goes to UnpublishedTopicMessages.',
      'The OrderStatus is stored as it was at the moment of failure, not re-queried later, so a later status change cannot leak into a stale retry.',
      'ScheduledUnpublishedTopicMessagesProcessor retries with the same claim/lease and circuit breaker protection.',
    ],
  },
  {
    title: 'Sequence-ordered notification delivery',
    summary: 'FIFO ordering plus an explicit sequence number, with out-of-order events persisted.',
    points: [
      'MessageGroupId = ClientOrderId gives ordered delivery per order.',
      'OrderExecutionProcessor publishes ACKNOWLEDGED/REJECTED as Sequence 1; ScheduledOrderStatusProcessor publishes FILLED as Sequence 2.',
      'A FILLED that arrives before ACKNOWLEDGED is recorded goes to PendingFilledNotifications — in the database, so it survives restarts — instead of being dropped or reordered in place.',
      'Once ACKNOWLEDGED is processed, the pending FILLED is replayed immediately and both tracking tables are cleaned up.',
    ],
  },
];

export const TRACING: readonly string[] = [
  'CorrelationId is generated in the API from Activity.Current?.TraceId, falling back to a new GUID.',
  'It is persisted on the Orders, OutboxMessages and related rows.',
  'It travels to SQS as a CorrelationId message attribute, and is embedded directly in the OrderStatusEvent payload for the SNS hop.',
  'Every Lambda logs it as a structured field.',
  'Each Lambda has its own CloudWatch log group, /aws/lambda/<FunctionName> — sharing infrastructure code does not merge logs.',
  'To trace a failure: CloudWatch → Log groups → the function’s group → search all streams for the CorrelationId or MessageId.',
];

export const ENUMS: readonly { name: string; values: string }[] = [
  { name: 'OrderStatus', values: '0 = PENDING_ACK · 1 = ACKNOWLEDGED · 2 = REJECTED · 3 = FILLED' },
  {
    name: 'OutboxRetryReason',
    values:
      '0 = None · 1 = SimpleQueueServiceUnavailable · 2 = InvalidPayload · 3 = DatabaseError · 4 = Unknown',
  },
  { name: 'DeadLetterCategory', values: '0 = BusinessFailure · 1 = InfrastructureFailure' },
  { name: 'ResiliencePolicyKey', values: 'Sql · Messaging' },
];

export const EVENT_CONTRACT = `public class OrderStatusEvent
{
    public Guid ClientOrderId { get; set; }
    public required string Status { get; set; }
    public DateTimeOffset EventTime { get; set; }
    public int Sequence { get; set; }
    public string CorrelationId { get; set; } = string.Empty;
}

public class OrderPayload
{
    public Guid ClientOrderId { get; set; }
}`;
