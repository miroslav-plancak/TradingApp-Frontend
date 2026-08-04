import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiConfigService } from '../../core/config/api-config.service';
import { DeadLetterCategory } from '../../core/models';
import { DeadLetterApiService } from './dead-letter-api.service';

/** Locks the `/api/deadletter` wire contract from AGENT_BRIEF.md. */
describe('DeadLetterApiService', () => {
  let service: DeadLetterApiService;
  let http: HttpTestingController;
  const base = 'https://localhost:7224/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(ApiConfigService).setBaseUrl(base);
    service = TestBed.inject(DeadLetterApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists all entries with GET /deadletter', () => {
    service.list('all').subscribe();
    const request = http.expectOne(`${base}/deadletter`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('maps the unresolved filter onto its own endpoint', () => {
    service.list('unresolved').subscribe();
    http.expectOne(`${base}/deadletter/unresolved`).flush([]);
  });

  it('reads stats with GET /deadletter/stats', () => {
    service.stats().subscribe();
    const request = http.expectOne(`${base}/deadletter/stats`);
    expect(request.request.method).toBe('GET');
    request.flush({ totalCount: 0, unresolvedCount: 0, resolvedCount: 0, last24Hours: 0 });
  });

  it('fetches one entry with GET /deadletter/{id}', () => {
    service.getById('abc-123').subscribe();
    const request = http.expectOne(`${base}/deadletter/abc-123`);
    expect(request.request.method).toBe('GET');
    request.flush(null);
  });

  it('fetches by client order id with GET /deadletter/by-client-order/{id}', () => {
    service.getByClientOrderId('order-9').subscribe();
    const request = http.expectOne(`${base}/deadletter/by-client-order/order-9`);
    expect(request.request.method).toBe('GET');
    request.flush(null);
  });

  it('resolves with POST /deadletter/{id}/resolve and the DTO body', () => {
    service.resolve('abc-123', { resolutionNotes: 'fixed', resolvedBy: 'ops' }).subscribe();
    const request = http.expectOne(`${base}/deadletter/abc-123/resolve`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ resolutionNotes: 'fixed', resolvedBy: 'ops' });
    request.flush(null);
  });

  it('creates with POST /deadletter, sending category as a number', () => {
    service
      .create({
        clientOrderId: 'c-1',
        messageBody: '{}',
        reason: 'test',
        category: DeadLetterCategory.InfrastructureFailure,
        correlationId: 'corr-1',
      })
      .subscribe();

    const request = http.expectOne(`${base}/deadletter`);
    expect(request.request.method).toBe('POST');
    // The API has no JsonStringEnumConverter — verified against the live API,
    // which rejects a string category with a 400.
    expect(request.request.body.category).toBe(1);
    request.flush(null);
  });

  it('url-encodes ids in both single-entry paths', () => {
    service.getById('a b/c').subscribe();
    http.expectOne(`${base}/deadletter/a%20b%2Fc`).flush(null);

    service.getByClientOrderId('a b/c').subscribe();
    http.expectOne(`${base}/deadletter/by-client-order/a%20b%2Fc`).flush(null);
  });

  it('deletes one entry with DELETE /deadletter/{id}', () => {
    service.delete('abc-123').subscribe();
    const request = http.expectOne(`${base}/deadletter/abc-123`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('deletes every entry with DELETE /deadletter', () => {
    service.deleteAll().subscribe();
    const request = http.expectOne(`${base}/deadletter`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ deletedCount: 2 });
  });
});
