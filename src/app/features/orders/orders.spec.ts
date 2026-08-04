import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { Store, provideStore, provideState } from '@ngrx/store';

import { Orders } from './orders';
import { OrdersActions } from './store/orders.actions';
import { ordersFeature } from './store/orders.reducer';

describe('Orders page', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [Orders],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(),
        provideState(ordersFeature),
        provideEffects(),
      ],
    });

    const store = TestBed.inject(Store);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(Orders);
    return { fixture, store, dispatch };
  }

  it('loads the list on init', () => {
    const { fixture, dispatch } = setup();
    fixture.detectChanges();

    expect(dispatch).toHaveBeenCalledWith(OrdersActions.loadOrders());
  });

  /**
   * Regression guard. Route-level `provideState`/`provideEffects` survive route
   * deactivation, so leaving the page without this would leave the poll timer
   * hitting the API from every other tab.
   */
  it('turns auto-refresh off when the page is destroyed', () => {
    const { fixture, store, dispatch } = setup();
    fixture.detectChanges();

    store.dispatch(OrdersActions.autoRefreshToggled({ enabled: true }));
    dispatch.mockClear();

    fixture.destroy();

    expect(dispatch).toHaveBeenCalledWith(OrdersActions.autoRefreshToggled({ enabled: false }));
  });

  it('does not dispatch on destroy when auto-refresh was never on', () => {
    const { fixture, dispatch } = setup();
    fixture.detectChanges();
    dispatch.mockClear();

    fixture.destroy();

    expect(dispatch).not.toHaveBeenCalled();
  });
});
