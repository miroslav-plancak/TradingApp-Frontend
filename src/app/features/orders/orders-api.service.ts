import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfigService } from '../../core/config/api-config.service';
import {
  CreateOrderRequest,
  CreatedOrderResponse,
  DeleteAllResponse,
  OrderResponse,
} from '../../core/models';

/**
 * Thin wrapper over `/api/order` (`OrderController`).
 *
 * Deliberately dumb: one method per endpoint, no state, no error handling, no
 * mapping. Effects own all of that. Keeping this layer mechanical is what makes
 * it replaceable by a generated OpenAPI client later.
 */
@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  /** `GET /api/order` */
  list(): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(this.config.url('/order'));
  }

  /** `GET /api/order/{orderId}` — 404 when missing. */
  getById(orderId: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(this.config.url(`/order/${encodeURIComponent(orderId)}`));
  }

  /** `POST /api/order` */
  create(request: CreateOrderRequest): Observable<CreatedOrderResponse> {
    return this.http.post<CreatedOrderResponse>(this.config.url('/order'), request);
  }

  /** `DELETE /api/order/{orderId}` — returns a bare boolean, 404 when missing. */
  delete(orderId: string): Observable<boolean> {
    return this.http.delete<boolean>(this.config.url(`/order/${encodeURIComponent(orderId)}`));
  }

  /** `DELETE /api/order` — deletes every order. */
  deleteAll(): Observable<DeleteAllResponse> {
    return this.http.delete<DeleteAllResponse>(this.config.url('/order'));
  }
}
