import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  /**
   * Default API base URL, including the `/api` segment.
   * This is only the *default* — the running app lets the operator edit it at
   * runtime (see `ApiConfigService`), which is how the console gets pointed at a
   * different backend without a rebuild.
   */
  apiBaseUrl: 'https://localhost:7224/api',
  /** Default interval for the per-feature "Auto 5s" polling toggles. */
  pollIntervalMs: 5000,
};
