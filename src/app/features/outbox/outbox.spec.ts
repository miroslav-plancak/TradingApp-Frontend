import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { Store, provideState, provideStore } from '@ngrx/store';

import { Outbox } from './outbox';
import { OutboxActions } from './store/outbox.actions';
import { outboxFeature } from './store/outbox.reducer';

describe('Outbox page', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [Outbox],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(),
        provideState(outboxFeature),
        provideEffects(),
      ],
    });

    const store = TestBed.inject(Store);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(Outbox);
    return { fixture, store, dispatch };
  }

  it('loads the list on init', () => {
    const { fixture, dispatch } = setup();
    fixture.detectChanges();

    expect(dispatch).toHaveBeenCalledWith(OutboxActions.loadOutbox());
  });

  /** Same trap as Orders: route providers outlive the route, so the timer must be stopped. */
  it('turns auto-refresh off when the page is destroyed', () => {
    const { fixture, store, dispatch } = setup();
    fixture.detectChanges();

    store.dispatch(OutboxActions.autoRefreshToggled({ enabled: true }));
    dispatch.mockClear();

    fixture.destroy();

    expect(dispatch).toHaveBeenCalledWith(OutboxActions.autoRefreshToggled({ enabled: false }));
  });

  it('does not dispatch on destroy when auto-refresh was never on', () => {
    const { fixture, dispatch } = setup();
    fixture.detectChanges();
    dispatch.mockClear();

    fixture.destroy();

    expect(dispatch).not.toHaveBeenCalled();
  });
});
