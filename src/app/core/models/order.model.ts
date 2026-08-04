/**
 * `/api/order` — models for `OrderController`.
 *
 * Source of truth: `TradingApp.Domain` DTOs (see AGENT_BRIEF.md).
 */

/**
 * `OrderStatus` crosses the wire as the enum's *name*, not its numeric value —
 * the DTOs declare `Status` as `string`, so the controller never exposes the int.
 * Backend enum: `PENDING_ACK = 0, ACKNOWLEDGED = 1, REJECTED = 2, FILLED = 3`.
 */
export type OrderStatus = 'PENDING_ACK' | 'ACKNOWLEDGED' | 'REJECTED' | 'FILLED';

/** All statuses, in backend declaration order — handy for filters and legends. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING_ACK',
  'ACKNOWLEDGED',
  'REJECTED',
  'FILLED',
] as const;

/** `CreateOrderRequestDTO` — body of `POST /api/order`. */
export interface CreateOrderRequest {
  quantity: number;
  price: number;
}

/** `CreatedOrderResponseDTO` — response of `POST /api/order`. */
export interface CreatedOrderResponse {
  id: string;
  clientOrderId: string;
  status: OrderStatus;
  quantity: number;
  price: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  isProcessed: boolean;
  /** Only present on the create response — used to trace the order through the pipeline. */
  correlationId: string;
}

/** `OrderResponseDTO` — response of `GET /api/order` and `GET /api/order/{orderId}`. */
export interface OrderResponse {
  id: string;
  clientOrderId: string;
  status: OrderStatus;
  quantity: number;
  price: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  isProcessed: boolean;
}
