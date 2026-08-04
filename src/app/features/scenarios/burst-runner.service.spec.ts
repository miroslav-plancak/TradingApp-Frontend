import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CreatedOrderResponse } from '../../core/models';
import { OrdersApiService } from '../orders/orders-api.service';
import { BurstRunnerService } from './burst-runner.service';

function order(): CreatedOrderResponse {
  return {
    id: 'order-1',
    clientOrderId: 'client-1',
    status: 'PENDING_ACK',
    quantity: 10,
    price: 1,
    createdAt: '2026-08-04T10:00:00Z',
    updatedAt: '2026-08-04T10:00:00Z',
    isProcessed: false,
    correlationId: 'corr-1',
  };
}

describe('BurstRunnerService', () => {
  function setup(create: () => ReturnType<OrdersApiService['create']>) {
    TestBed.configureTestingModule({
      providers: [BurstRunnerService, { provide: OrdersApiService, useValue: { create } }],
    });
    return TestBed.inject(BurstRunnerService);
  }

  const settings = { count: 3, delay: 0, minQuantity: 1, maxQuantity: 10 };

  it('counts every submission as sent and successful', async () => {
    const service = setup(() => of(order()));

    await service.start(settings);

    const state = service.state();
    expect(state.sent).toBe(3);
    expect(state.success).toBe(3);
    expect(state.failed).toBe(0);
    expect(state.running).toBe(false);
  });

  it('keeps going after a failure and counts it', async () => {
    let call = 0;
    const service = setup(() => {
      call++;
      return call === 2 ? throwError(() => new Error('boom')) : of(order());
    });

    await service.start(settings);

    expect(service.state().sent).toBe(3);
    expect(service.state().success).toBe(2);
    expect(service.state().failed).toBe(1);
  });

  it('generates quantities inside the requested bounds', async () => {
    const quantities: number[] = [];
    const service = setup((...args: unknown[]) => {
      quantities.push((args[0] as { quantity: number }).quantity);
      return of(order());
    });

    await service.start({ count: 25, delay: 0, minQuantity: 5, maxQuantity: 7 });

    expect(quantities.length).toBe(25);
    expect(Math.min(...quantities)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...quantities)).toBeLessThanOrEqual(7);
  });

  it('ignores a second start while one is already running', async () => {
    const service = setup(() => of(order()));

    const first = service.start({ ...settings, count: 2 });
    await service.start({ ...settings, count: 50 });
    await first;

    expect(service.state().sent).toBe(2);
  });

  it('stops early and reports it', async () => {
    const service = setup(() => of(order()));

    const run = service.start({ count: 500, delay: 20, minQuantity: 1, maxQuantity: 2 });
    service.stop();
    await run;

    expect(service.state().running).toBe(false);
    expect(service.state().sent).toBeLessThan(500);
    expect(service.state().lines.at(-1)?.text).toContain('stopped');
  });
});
