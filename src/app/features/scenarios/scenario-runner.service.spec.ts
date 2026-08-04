import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DeadLetterCategory, DeadLetterLogResponse } from '../../core/models';
import { DeadLetterApiService } from '../dead-letter/dead-letter-api.service';
import { OrdersApiService } from '../orders/orders-api.service';
import { OutboxApiService } from '../outbox/outbox-api.service';
import { ScenarioRunnerService } from './scenario-runner.service';

function deadLetter(overrides: Partial<DeadLetterLogResponse> = {}): DeadLetterLogResponse {
  return {
    id: 'dl-1',
    clientOrderId: 'client-1',
    reason: 'scenario test',
    category: DeadLetterCategory.BusinessFailure,
    createdAt: '2026-08-04T10:00:00Z',
    isResolved: false,
    resolutionNotes: '',
    resolvedAt: null,
    resolvedBy: '',
    messageBody: '{"scenario":true}',
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('ScenarioRunnerService', () => {
  function setup(deadLetterApi: Partial<DeadLetterApiService>) {
    TestBed.configureTestingModule({
      providers: [
        ScenarioRunnerService,
        { provide: OrdersApiService, useValue: {} },
        { provide: OutboxApiService, useValue: {} },
        { provide: DeadLetterApiService, useValue: deadLetterApi },
      ],
    });
    return TestBed.inject(ScenarioRunnerService);
  }

  it('starts idle with an empty log', () => {
    const service = setup({});
    const run = service.runFor('dead-letter-roundtrip');

    expect(run().status).toBe('idle');
    expect(run().lines).toEqual([]);
  });

  it('passes the dead letter round-trip when inject, lookup and resolve all line up', async () => {
    const service = setup({
      create: () => of(deadLetter()),
      getByClientOrderId: () => of(deadLetter()),
      resolve: () => of(deadLetter({ isResolved: true })),
    });

    await service.start('dead-letter-roundtrip', {});

    const run = service.runFor('dead-letter-roundtrip')();
    expect(run.status).toBe('passed');
    expect(run.finishedAt).not.toBeNull();
    expect(run.lines.some((line) => line.text.includes('PASS'))).toBe(true);
  });

  /** The lookup returning a different entry means the endpoint is not doing its job. */
  it('reports partial when the lookup returns a different entry', async () => {
    const service = setup({
      create: () => of(deadLetter({ id: 'dl-1' })),
      getByClientOrderId: () => of(deadLetter({ id: 'someone-else' })),
      resolve: () => of(deadLetter({ id: 'dl-1', isResolved: true })),
    });

    await service.start('dead-letter-roundtrip', {});

    expect(service.runFor('dead-letter-roundtrip')().status).toBe('partial');
  });

  it('fails the run and logs the reason when a call throws', async () => {
    const service = setup({ create: () => throwError(() => new Error('API offline')) });

    await service.start('dead-letter-roundtrip', {});

    const run = service.runFor('dead-letter-roundtrip')();
    expect(run.status).toBe('failed');
    expect(run.lines.some((line) => line.text.includes('API offline'))).toBe(true);
  });

  it('sends the category as the numeric enum the API accepts', async () => {
    const create = vi.fn(() => of(deadLetter()));
    const service = setup({
      create,
      getByClientOrderId: () => of(deadLetter()),
      resolve: () => of(deadLetter({ isResolved: true })),
    });

    await service.start('dead-letter-roundtrip', {});

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ category: DeadLetterCategory.BusinessFailure }),
    );
  });

  /**
   * Same class of bug as the poll timers: a long run must not keep driving the
   * API after the operator leaves the page.
   */
  it('cancels a run in flight when the service is destroyed', async () => {
    let resolveCreate: ((value: DeadLetterLogResponse) => void) | undefined;
    const service = setup({
      create: () =>
        new Promise<DeadLetterLogResponse>((resolve) => {
          resolveCreate = resolve;
        }) as never,
    });

    const run = service.start('dead-letter-roundtrip', {});
    service.ngOnDestroy();

    expect(service.runFor('dead-letter-roundtrip')().status).toBe('cancelled');

    resolveCreate?.(deadLetter());
    await run;
  });
});
