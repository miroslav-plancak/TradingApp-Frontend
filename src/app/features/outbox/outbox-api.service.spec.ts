import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiConfigService } from '../../core/config/api-config.service';
import { OutboxApiService } from './outbox-api.service';

/** Locks the `/api/outboxmessage` wire contract from AGENT_BRIEF.md. */
describe('OutboxApiService', () => {
  let service: OutboxApiService;
  let http: HttpTestingController;
  const base = 'https://localhost:7224/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(ApiConfigService).setBaseUrl(base);
    service = TestBed.inject(OutboxApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists all messages with GET /outboxmessage', () => {
    service.list('all').subscribe();
    const request = http.expectOne(`${base}/outboxmessage`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('defaults to the unfiltered list', () => {
    service.list().subscribe();
    http.expectOne(`${base}/outboxmessage`).flush([]);
  });

  it('maps the unprocessed and processed filters onto their own endpoints', () => {
    service.list('unprocessed').subscribe();
    http.expectOne(`${base}/outboxmessage/unprocessed`).flush([]);

    service.list('processed').subscribe();
    http.expectOne(`${base}/outboxmessage/processed`).flush([]);
  });

  it('reads stats with GET /outboxmessage/stats', () => {
    service.stats().subscribe();
    const request = http.expectOne(`${base}/outboxmessage/stats`);
    expect(request.request.method).toBe('GET');
    request.flush({ totalCount: 0, processedCount: 0, unprocessedCount: 0, last24Hours: 0 });
  });

  it('fetches one message with GET /outboxmessage/{id}', () => {
    service.getById('abc-123').subscribe();
    const request = http.expectOne(`${base}/outboxmessage/abc-123`);
    expect(request.request.method).toBe('GET');
    request.flush(null);
  });

  it('marks processed with POST /outboxmessage/{id}/mark-processed and no body', () => {
    service.markProcessed('abc-123').subscribe();
    const request = http.expectOne(`${base}/outboxmessage/abc-123/mark-processed`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(null);
  });

  it('url-encodes ids in both single-message paths', () => {
    service.getById('a b/c').subscribe();
    http.expectOne(`${base}/outboxmessage/a%20b%2Fc`).flush(null);

    service.markProcessed('a b/c').subscribe();
    http.expectOne(`${base}/outboxmessage/a%20b%2Fc/mark-processed`).flush(null);
  });

  it('deletes one message with DELETE /outboxmessage/{id}', () => {
    service.delete('abc-123').subscribe();
    const request = http.expectOne(`${base}/outboxmessage/abc-123`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('deletes every message with DELETE /outboxmessage', () => {
    service.deleteAll().subscribe();
    const request = http.expectOne(`${base}/outboxmessage`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ deletedCount: 7 });
  });
});
