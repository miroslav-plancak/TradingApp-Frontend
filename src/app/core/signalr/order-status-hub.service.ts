  import { Injectable, inject } from '@angular/core';
  import * as signalR from '@microsoft/signalr';
  import { Observable, Subject, filter, take } from 'rxjs';

  import { ApiConfigService } from '../config/api-config.service';
  import { OrderResponse } from '../models/order.model';

  export interface OrderStatusChangedEvent {
    clientOrderId: string;
    status: string;
  }

  /**
   * Every request/response pair this hub supports - the client invoke() method
   * name mapped to the server push event name that answers it. This is the
   * single place that declares the pairing; connect()'s .on() registrations
   * and each requestX() method both read from here (never a hardcoded string
   * of their own), so the two halves of a pair can't silently drift apart or
   * require cross-referencing two separate call sites by hand.
   */
  export enum OrderHubRequestMethod {
    RequestCurrentStatus = 'RequestCurrentStatus',
  }

  export enum OrderHubResponseEvent {
    CurrentOrderStatus = 'CurrentOrderStatus',
  }

  const HUB_REQUEST_RESPONSE: Record<OrderHubRequestMethod, OrderHubResponseEvent> = {
    [OrderHubRequestMethod.RequestCurrentStatus]: OrderHubResponseEvent.CurrentOrderStatus,
  };

  // type HubRequestMethod = OrderHubRequestMethod;

  @Injectable({ providedIn: 'root' })
  export class OrderStatusHubService {
    private readonly apiConfig = inject(ApiConfigService);
    private connection: signalR.HubConnection | null = null;

    private readonly _orderStatusChanged$ = new Subject<OrderStatusChangedEvent>();
    readonly orderStatusChanged$ = this._orderStatusChanged$.asObservable();

    // Not exposed publicly - only requestCurrentStatus() should ever read from
    // this, so callers never need to know the underlying event/Subject exists.
    private readonly _currentOrderStatus$ = new Subject<OrderResponse>();

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

      this.connection.on('OrderStatusChanged', (clientOrderId: string, status: string) => {
        this._orderStatusChanged$.next({ clientOrderId, status });
      });

      this.connection.on(HUB_REQUEST_RESPONSE.RequestCurrentStatus, (order: OrderResponse) => {
        this._currentOrderStatus$.next(order);
      });

      await this.connection.start();
    }

    requestCurrentStatus(orderId: string): Observable<OrderResponse> {
      return this.requestResponse(
        OrderHubRequestMethod.RequestCurrentStatus,
        this._currentOrderStatus$,
        (order) => order.id === orderId,
        orderId,
      );
    }

    /**
     * Generic request/response bridge: invokes `method` on the hub, and
     * resolves with the first value on `responses$` that satisfies `matches`.
     * `method` is typed as a key of HUB_REQUEST_RESPONSE, so a future
     * requestY() method can't invoke a hub method name that was never
     * declared as pairing with anything up there - the compiler rejects it.
     */
    private requestResponse<TResponse>(
      method: OrderHubRequestMethod,
      responses$: Observable<TResponse>,
      matches: (value: TResponse) => boolean,
      ...args: unknown[]
    ): Observable<TResponse> {
      return new Observable<TResponse>((subscriber) => {
        if (!this.connection) {
          subscriber.error(new Error('SignalR connection not established yet.'));
          return;
        }

        const sub = responses$.pipe(filter(matches), take(1)).subscribe(subscriber);

        this.connection.invoke(method, ...args).catch((err) => subscriber.error(err));

        return () => sub.unsubscribe();
      });
    }
  }
