import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { Store, provideState, provideStore } from '@ngrx/store';

import { DeadLetter } from './dead-letter';
import { DeadLetterActions } from './store/dead-letter.actions';
import { deadLetterFeature } from './store/dead-letter.reducer';

describe('Dead Letter page', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [DeadLetter],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(),
        provideState(deadLetterFeature),
        provideEffects(),
      ],
    });

    const store = TestBed.inject(Store);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(DeadLetter);
    return { fixture, store, dispatch };
  }

  it('loads the list on init', () => {
    const { fixture, dispatch } = setup();
    fixture.detectChanges();

    expect(dispatch).toHaveBeenCalledWith(DeadLetterActions.loadDeadLetters());
  });

  /** Same trap as Orders and Outbox: route providers outlive the route. */
  it('turns auto-refresh off when the page is destroyed', () => {
    const { fixture, store, dispatch } = setup();
    fixture.detectChanges();

    store.dispatch(DeadLetterActions.autoRefreshToggled({ enabled: true }));
    dispatch.mockClear();

    fixture.destroy();

    expect(dispatch).toHaveBeenCalledWith(DeadLetterActions.autoRefreshToggled({ enabled: false }));
  });

  it('does not dispatch on destroy when auto-refresh was never on', () => {
    const { fixture, dispatch } = setup();
    fixture.detectChanges();
    dispatch.mockClear();

    fixture.destroy();

    expect(dispatch).not.toHaveBeenCalled();
  });
});
