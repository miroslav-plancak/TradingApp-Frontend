import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a nav link for every feature tab', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav a'),
    ).map((a) => a.textContent?.replace(/\s+/g, ' ').trim());

    expect(labels).toEqual([
      'receipt_long Orders',
      'outbox Outbox',
      'report Dead Letter',
      'science Scenarios',
      'account_tree Architecture',
    ]);
  });
});
