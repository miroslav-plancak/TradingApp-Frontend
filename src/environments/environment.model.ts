/**
 * Shape shared by every environment file, so a missing key in one of them is a
 * compile error rather than an `undefined` at runtime.
 */
export interface Environment {
  production: boolean;
  /** API base URL *including* the `/api` segment, e.g. `https://localhost:7224/api`. */
  apiBaseUrl: string;
  /** Default interval for the per-feature auto-refresh (polling) toggles, in ms. */
  pollIntervalMs: number;
}
