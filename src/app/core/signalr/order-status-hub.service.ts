  import { Injectable, inject } from '@angular/core';
  import * as signalR from '@microsoft/signalr';
  import { Subject } from 'rxjs';

  import { ApiConfigService } from '../config/api-config.service';

  export interface OrderStatusChangedEvent {
    clientOrderId: string;
    status: string;
  }

  @Injectable({ providedIn: 'root' })
  export class OrderStatusHubService {
    private readonly apiConfig = inject(ApiConfigService);
    private connection: signalR.HubConnection | null = null;

    private readonly _orderStatusChanged$ = new Subject<OrderStatusChangedEvent>();
    readonly orderStatusChanged$ = this._orderStatusChanged$.asObservable();

    async connect(): Promise<void> {
      if (this.connection) {
        return;
      }

      // apiConfig.baseUrl() includes "/api" - the hub isn't under that prefix.
      const hubUrl = `${this.apiConfig.baseUrl().replace(/\/api\/?$/, '')}/hubs/orders`;

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect()
        .build();

      this.connection.on('OrderStatusChanged', (clientOrderId: string, status: string, number: number) => {
        console.log(`clientOrderId`,clientOrderId)
        console.log(`clientOrderId`,status)
        console.log(`number`,number)
        this._orderStatusChanged$.next({ clientOrderId, status });
      });

      await this.connection.start();
    }
  }
