  import { Injectable, inject } from '@angular/core';
  import * as signalR from '@microsoft/signalr';
  import { Observable, Subject, filter, take } from 'rxjs';

  import { ApiConfigService } from '../config/api-config.service';
  import { OrderResponse } from '../models/order.model';
  import { OutboxMessageResponse } from '../models/outbox.model';
  import { DeadLetterLogResponse } from '../models/dead-letter.model';

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

  /** Server push event name for the Order entity. */
  export enum OrderHubPushEvent {
    OrderStatusChangedEvent = 'OrderStatusChangedEvent',
  }

  /** Server push event name for the Outbox entity. */
  export enum OutboxHubPushEvent {
    OutboxMessageProcessedEvent = 'OutboxMessageProcessedEvent',
  }

  /** Server push event name for the DeadLetter entity. */
  export enum DeadLetterHubPushEvent {
    DeadLetterLogPersistedEvent = 'DeadLetterLogPersistedEvent',
  }

  @Injectable({ providedIn: 'root' })
  export class EventsHubService {
    private readonly apiConfig = inject(ApiConfigService);
    private connection: signalR.HubConnection | null = null;

    // The push now carries the full order (see SignalRPushBackgroundService), so
    // this is Subject<OrderResponse> directly - no separate wrapper event type needed.
    private readonly _orderStatusChanged$ = new Subject<OrderResponse>();
    readonly orderStatusChanged$ = this._orderStatusChanged$.asObservable();

    // Same shape as orderStatusChanged$ - the backend resolves the full row
    // before pushing, so these are the full DTOs, not a follow-up-fetch signal.
    private readonly _outboxMessageChanged$ = new Subject<OutboxMessageResponse>();
    readonly outboxMessageChanged$ = this._outboxMessageChanged$.asObservable();

    private readonly _deadLetterLogChanged$ = new Subject<DeadLetterLogResponse>();
    readonly deadLetterLogChanged$ = this._deadLetterLogChanged$.asObservable();

    // Not exposed publicly - only requestCurrentStatus() should ever read from
    // this, so callers never need to know the underlying event/Subject exists.
    private readonly _currentOrderStatus$ = new Subject<OrderResponse>();

    async connect(): Promise<void> {
      if (this.connection) {
        return;
      }

      // apiConfig.baseUrl() includes "/api" - the hub isn't under that prefix.
      const hubUrl = `${this.apiConfig.baseUrl().replace(/\/api\/?$/, '')}/hubs/events`;

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect()
        .build();

      // Event name matches the backend's nameof(OrderStatusChangedEvent) exactly -
      // SignalRPushBackgroundService can never send a name this doesn't match.
      this.connection.on(OrderHubPushEvent.OrderStatusChangedEvent, (order: OrderResponse) => {
        this._orderStatusChanged$.next(order);
      });

      // Event names match the backend's nameof(...) for each event type exactly -
      // same reasoning as OrderStatusChangedEvent above.
      this.connection.on(OutboxHubPushEvent.OutboxMessageProcessedEvent, (message: OutboxMessageResponse) => {
        this._outboxMessageChanged$.next(message);
      });

      this.connection.on(DeadLetterHubPushEvent.DeadLetterLogPersistedEvent, (entry: DeadLetterLogResponse) => {
        this._deadLetterLogChanged$.next(entry);
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
