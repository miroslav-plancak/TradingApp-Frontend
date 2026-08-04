import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfigService } from '../../core/config/api-config.service';
import {
  CreateDeadLetterRequest,
  DeadLetterLogResponse,
  DeadLetterStats,
  DeleteAllResponse,
  ResolveDeadLetterRequest,
} from '../../core/models';

/** Which server-side list endpoint the page is showing. */
export type DeadLetterFilter = 'all' | 'unresolved';

/**
 * Thin wrapper over `/api/deadletter` (`DeadLetterController`).
 *
 * Same shape as the Orders and Outbox services: one method per endpoint, no
 * state, no error handling, no mapping.
 */
@Injectable({ providedIn: 'root' })
export class DeadLetterApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  /** `GET /api/deadletter` or `/unresolved`. */
  list(filter: DeadLetterFilter = 'all'): Observable<DeadLetterLogResponse[]> {
    const path = filter === 'all' ? '/deadletter' : '/deadletter/unresolved';
    return this.http.get<DeadLetterLogResponse[]>(this.config.url(path));
  }

  /** `GET /api/deadletter/stats` */
  stats(): Observable<DeadLetterStats> {
    return this.http.get<DeadLetterStats>(this.config.url('/deadletter/stats'));
  }

  /** `GET /api/deadletter/{id}` — 404 when missing. */
  getById(id: string): Observable<DeadLetterLogResponse> {
    return this.http.get<DeadLetterLogResponse>(
      this.config.url(`/deadletter/${encodeURIComponent(id)}`),
    );
  }

  /** `GET /api/deadletter/by-client-order/{clientOrderId}` — 404 when missing. */
  getByClientOrderId(clientOrderId: string): Observable<DeadLetterLogResponse> {
    return this.http.get<DeadLetterLogResponse>(
      this.config.url(`/deadletter/by-client-order/${encodeURIComponent(clientOrderId)}`),
    );
  }

  /** `POST /api/deadletter/{id}/resolve` — 404 when missing. */
  resolve(id: string, request: ResolveDeadLetterRequest): Observable<DeadLetterLogResponse> {
    return this.http.post<DeadLetterLogResponse>(
      this.config.url(`/deadletter/${encodeURIComponent(id)}/resolve`),
      request,
    );
  }

  /** `POST /api/deadletter` — manual injection, for testing the triage flow. */
  create(request: CreateDeadLetterRequest): Observable<DeadLetterLogResponse> {
    return this.http.post<DeadLetterLogResponse>(this.config.url('/deadletter'), request);
  }

  /** `DELETE /api/deadletter/{id}` — returns the deleted entry, 404 when missing. */
  delete(id: string): Observable<DeadLetterLogResponse> {
    return this.http.delete<DeadLetterLogResponse>(
      this.config.url(`/deadletter/${encodeURIComponent(id)}`),
    );
  }

  /** `DELETE /api/deadletter` — deletes every entry. */
  deleteAll(): Observable<DeleteAllResponse> {
    return this.http.delete<DeleteAllResponse>(this.config.url('/deadletter'));
  }
}
