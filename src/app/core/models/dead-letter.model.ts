/**
 * `/api/deadletter` — models for `DeadLetterController`.
 */

/**
 * `DeadLetterCategory` wire format.
 *
 * VERIFIED STATICALLY, NOT AT RUNTIME: the backend registers no
 * `JsonStringEnumConverter` (grepped all of `TradingApp-AWS` — the only
 * `JsonSerializerOptions` in the solution is in `TradingAppLogger`, not in the
 * API's `Program.cs`), so System.Text.Json's default applies and this enum
 * serializes **numerically**. The live API was not running when this was
 * written, so re-confirm against one real response in the Dead Letter phase
 * before trusting it; if it turns out to be a string, this becomes a string
 * literal union and only this file plus the label map change.
 *
 * Backend enum: `BusinessFailure = 0, InfrastructureFailure = 1`.
 */
export const DeadLetterCategory = {
  BusinessFailure: 0,
  InfrastructureFailure: 1,
} as const;

export type DeadLetterCategory = (typeof DeadLetterCategory)[keyof typeof DeadLetterCategory];

/** Human-readable labels for display; keep in sync with the enum above. */
export const DEAD_LETTER_CATEGORY_LABELS: Record<DeadLetterCategory, string> = {
  [DeadLetterCategory.BusinessFailure]: 'Business failure',
  [DeadLetterCategory.InfrastructureFailure]: 'Infrastructure failure',
};

/** `CreateDeadLetterRequestDTO` — body of `POST /api/deadletter` (manual injection for testing). */
export interface CreateDeadLetterRequest {
  clientOrderId: string;
  messageBody: string;
  reason: string;
  category: DeadLetterCategory;
  correlationId: string;
}

/** `ResolveDeadLetterRequestDTO` — body of `POST /api/deadletter/{id}/resolve`. */
export interface ResolveDeadLetterRequest {
  resolutionNotes: string;
  resolvedBy: string;
}

/** `DeadLetterLogResponseDTO`. */
export interface DeadLetterLogResponse {
  id: string;
  clientOrderId: string;
  reason: string;
  category: DeadLetterCategory;
  /** ISO 8601 */
  createdAt: string;
  isResolved: boolean;
  resolutionNotes: string;
  /** ISO 8601, null while unresolved. */
  resolvedAt: string | null;
  resolvedBy: string;
  /** Raw message body that failed — a JSON *string*, not a nested object. */
  messageBody: string;
  correlationId: string;
}

/** `DeadLetterStatsDTO` — response of `GET /api/deadletter/stats`. */
export interface DeadLetterStats {
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  last24Hours: number;
}
