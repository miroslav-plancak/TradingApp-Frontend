import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turn an HTTP failure into a message worth showing an operator.
 *
 * The backend has two distinct error shapes:
 * - `ExceptionHandlingMiddleware` serializes `ProblemDetails` with the default
 *   (non-web) `JsonSerializer` options, so its keys are **PascalCase**:
 *   `{ Status, Title, Detail }`.
 * - `[ApiController]` model-validation failures use ASP.NET's own camelCase
 *   ProblemDetails: `{ status, title, errors }`.
 *
 * Both are handled here so no caller has to care.
 */
export function toErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error ? error.message : fallback;
  }

  // status 0 means the request never got a response: server down, wrong port,
  // or — very common with this backend — an untrusted dev certificate.
  if (error.status === 0) {
    return 'Cannot reach the API. Check that TradingApp.API is running, that the base URL is right, and that you have accepted its development certificate in this browser.';
  }

  const detail = extractDetail(error.error);
  return detail ? `${error.status} ${error.statusText}: ${detail}` : `${error.status} ${error.statusText}`;
}

function extractDetail(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }
  if (!body || typeof body !== 'object') {
    return null;
  }

  const problem = body as Record<string, unknown>;

  // Validation errors: { errors: { Quantity: ['must be > 0'], ... } }
  const errors = problem['errors'];
  if (errors && typeof errors === 'object') {
    const messages = Object.values(errors as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === 'string');
    if (messages.length) {
      return messages.join(' ');
    }
  }

  for (const key of ['Detail', 'detail', 'Title', 'title', 'message']) {
    const value = problem[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}
