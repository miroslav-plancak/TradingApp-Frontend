import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiConfigService } from '../../core/config/api-config.service';
import { OrdersApiService } from './orders-api.service';

/**
 * Locks the wire contract from AGENT_BRIEF.md: verb, path, and body for every
 * `/api/order` endpoint. If the backend ever moves one, this fails loudly here
 * instead of silently at runtime.
 */
describe('OrdersApiService', () => {
  let service: OrdersApiService;
  let http: HttpTestingController;
  const base = 'https://localhost:7224/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(ApiConfigService).setBaseUrl(base);
    service = TestBed.inject(OrdersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists orders with GET /order', () => {
    service.list().subscribe();
    const request = http.expectOne(`${base}/order`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('fetches one order with GET /order/{id}', () => {
    service.getById('abc-123').subscribe();
    const request = http.expectOne(`${base}/order/abc-123`);
    expect(request.request.method).toBe('GET');
    request.flush(null);
  });

  it('url-encodes the id so a stray value cannot break the path', () => {
    service.getById('a b/c').subscribe();
    const request = http.expectOne(`${base}/order/a%20b%2Fc`);
    request.flush(null);
  });

  it('creates an order with POST /order and the DTO body', () => {
    service.create({ quantity: 5, price: 12.25 }).subscribe();
    const request = http.expectOne(`${base}/order`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ quantity: 5, price: 12.25 });
    request.flush(null);
  });

  it('deletes one order with DELETE /order/{id}', () => {
    service.delete('abc-123').subscribe();
    const request = http.expectOne(`${base}/order/abc-123`);
    expect(request.request.method).toBe('DELETE');
    request.flush(true);
  });

  it('deletes every order with DELETE /order', () => {
    service.deleteAll().subscribe();
    const request = http.expectOne(`${base}/order`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ deletedCount: 3 });
  });

  it('follows the base URL when the operator re-points the console', () => {
    TestBed.inject(ApiConfigService).setBaseUrl('http://localhost:7777/api/');
    service.list().subscribe();
    // Trailing slash is normalized away by ApiConfigService.
    http.expectOne('http://localhost:7777/api/order').flush([]);
  });
});
