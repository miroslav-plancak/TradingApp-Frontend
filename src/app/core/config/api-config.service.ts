import { Injectable, computed, effect, signal } from '@angular/core';

import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'tradingapp-ops.apiBaseUrl';

/** Trim whitespace and any trailing slashes so `url()` can join with a single `/`. */
function normalize(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function readStored(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalize(stored) : null;
  } catch {
    // localStorage can throw in locked-down browser contexts; fall back to the default.
    return null;
  }
}

/**
 * Holds the API base URL the console talks to.
 *
 * The original single-file console kept this in an editable header input so an
 * operator could re-point at another environment without a rebuild — that stays.
 * `environment.apiBaseUrl` is only the default; the operator's override wins and
 * is persisted to `localStorage`.
 *
 * Everything that talks to the backend goes through `url()`, so this is the one
 * place that knows how a request URL is assembled.
 */
@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly _baseUrl = signal(readStored() ?? environment.apiBaseUrl);

  /** Current base URL, including the `/api` segment, without a trailing slash. */
  readonly baseUrl = this._baseUrl.asReadonly();

  /** The compiled-in default, for the "reset" affordance. */
  readonly defaultBaseUrl = environment.apiBaseUrl;

  /** Default auto-refresh interval for the per-feature polling toggles. */
  readonly pollIntervalMs = environment.pollIntervalMs;

  readonly isDefault = computed(() => this._baseUrl() === this.defaultBaseUrl);

  constructor() {
    effect(() => {
      const current = this._baseUrl();
      try {
        localStorage.setItem(STORAGE_KEY, current);
      } catch {
        // Persistence is a convenience, not a requirement — ignore quota/privacy errors.
      }
    });
  }

  setBaseUrl(value: string): void {
    this._baseUrl.set(normalize(value) || this.defaultBaseUrl);
  }

  reset(): void {
    this._baseUrl.set(this.defaultBaseUrl);
  }

  /** Absolute URL for an endpoint path, e.g. `url('/order/123')`. */
  url(path: string): string {
    return `${this._baseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  }
}
