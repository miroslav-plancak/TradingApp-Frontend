import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfigService } from '../../core/config/api-config.service';
import { DeleteAllResponse, OutboxMessageResponse, OutboxMessageStats } from '../../core/models';

/** Which server-side list endpoint the page is showing. */
export type OutboxFilter = 'all' | 'unprocessed' | 'processed';

/**
 * Thin wrapper over `/api/outboxmessage` (`OutboxMessageController`).
 *
 * Same shape as `OrdersApiService`: one method per endpoint, no state, no error
 * handling, no mapping — effects own all of that.
 */
@Injectable({ providedIn: 'root' })
export class OutboxApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  /**
   * `GET /api/outboxmessage`, `/unprocessed` or `/processed`.
   *
   * The filter picks the endpoint here rather than in the effect, so callers
   * only ever deal with one list method.
   */
  list(filter: OutboxFilter = 'all'): Observable<OutboxMessageResponse[]> {
    const path = filter === 'all' ? '/outboxmessage' : `/outboxmessage/${filter}`;
    return this.http.get<OutboxMessageResponse[]>(this.config.url(path));
  }

  /** `GET /api/outboxmessage/stats` */
  stats(): Observable<OutboxMessageStats> {
    return this.http.get<OutboxMessageStats>(this.config.url('/outboxmessage/stats'));
  }

  /** `GET /api/outboxmessage/{id}` — 404 when missing. */
  getById(id: string): Observable<OutboxMessageResponse> {
    return this.http.get<OutboxMessageResponse>(
      this.config.url(`/outboxmessage/${encodeURIComponent(id)}`),
    );
  }

  /**
   * `POST /api/outboxmessage/{id}/mark-processed` — 404 when missing.
   *
   * Takes no body; the id in the path is the whole request.
   */
  markProcessed(id: string): Observable<OutboxMessageResponse> {
    return this.http.post<OutboxMessageResponse>(
      this.config.url(`/outboxmessage/${encodeURIComponent(id)}/mark-processed`),
      null,
    );
  }

  /** `DELETE /api/outboxmessage/{id}` — returns the deleted message, 404 when missing. */
  delete(id: string): Observable<OutboxMessageResponse> {
    return this.http.delete<OutboxMessageResponse>(
      this.config.url(`/outboxmessage/${encodeURIComponent(id)}`),
    );
  }

  /** `DELETE /api/outboxmessage` — deletes every message. */
  deleteAll(): Observable<DeleteAllResponse> {
    return this.http.delete<DeleteAllResponse>(this.config.url('/outboxmessage'));
  }
}
