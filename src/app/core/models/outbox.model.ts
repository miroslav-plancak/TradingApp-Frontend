/**
 * `/api/outboxmessage` — models for `OutboxMessageController`.
 */

/** `OutboxMessageResponseDTO`. */
export interface OutboxMessageResponse {
  id: string;
  /** Message type name, e.g. the integration event's CLR type. */
  type: string;
  /** Serialized event body — a JSON *string*, not a nested object. */
  payload: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601, null until the outbox processor drains the row. */
  processedAt: string | null;
  retryCount: number;
  isProcessed: boolean;
}

/** `OutboxMessageStatsDTO` — response of `GET /api/outboxmessage/stats`. */
export interface OutboxMessageStats {
  totalCount: number;
  processedCount: number;
  unprocessedCount: number;
  last24Hours: number;
}
