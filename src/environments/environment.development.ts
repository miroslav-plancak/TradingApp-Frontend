import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  /** Local `TradingApp.API` (`dotnet run`, Kestrel HTTPS) — see AGENT_BRIEF.md. */
  apiBaseUrl: 'https://localhost:7224/api',
  pollIntervalMs: 5000,
};
