/**
 * Shared wire types.
 *
 * The API returns raw JSON directly (`Ok(result)`) — there is no
 * `{ success, data }` envelope anywhere. Model responses 1:1 against the DTOs.
 *
 * Conventions used across all model files:
 * - C# `Guid`            -> `string`
 * - C# `DateTimeOffset`  -> `string` (ISO 8601); parse to `Date` only at display time
 * - C# `decimal`         -> `number`
 * - ASP.NET Core serializes property names as camelCase (default web JSON options).
 */

/** Response shape of the bulk `DELETE` endpoints (`/api/order`, `/api/outboxmessage`, `/api/deadletter`). */
export interface DeleteAllResponse {
  deletedCount: number;
}
