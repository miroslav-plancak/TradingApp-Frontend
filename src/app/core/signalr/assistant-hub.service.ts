import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable } from 'rxjs';

import { ApiConfigService } from '../config/api-config.service';

/**
 * Streaming-only hub - unlike EventsHubService, there are no push events or
 * request/response pairs to declare. Ask() is a SignalR *streaming* hub
 * method (server-side: IAsyncEnumerable<string>), so the client calls
 * .stream() instead of .invoke()/.on(), and gets one emission per server
 * `yield return`, in order.
 *
 * Deliberately a separate hub/connection from EventsHubService - chat traffic
 * (bidirectional, one request in, many chunks back) has a different shape
 * than the push-only IntegrationEvents socket.
 */
@Injectable({ providedIn: 'root' })
export class AssistantHubService {
  private readonly apiConfig = inject(ApiConfigService);
  private connection: signalR.HubConnection | null = null;

  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }

    // apiConfig.baseUrl() includes "/api" - the hub isn't under that prefix.
    const hubUrl = `${this.apiConfig.baseUrl().replace(/\/api\/?$/, '')}/hubs/assistant`;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    await this.connection.start();
  }

  /**
   * Streams the model's answer one chunk at a time - each emission is one
   * `yield return` from the server's Ask() method, in the order the server
   * produced them. Completes when the server's IAsyncEnumerable ends; errors
   * if the underlying stream breaks.
   */
  ask(question: string): Observable<string> {
    return new Observable<string>((subscriber) => {
      if (!this.connection) {
        subscriber.error(new Error('SignalR connection not established yet.'));
        return;
      }

      const subscription = this.connection.stream<string>('Ask', question).subscribe({
        next: (chunk) => subscriber.next(chunk),
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });

      return () => subscription.dispose();
    });
  }
}
