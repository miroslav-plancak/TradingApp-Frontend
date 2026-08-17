import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription } from 'rxjs';

import { AssistantHubService } from '../../core/signalr/assistant-hub.service';

/**
 * Bare-bones proof that the AiChatHub streaming pipe works end to end -
 * question in, chunks appended to `answer` as they arrive. No history, no
 * ngRx slice yet: this exists to isolate the client/server boundary before
 * building the real chat UI on top of it (task #36).
 */
@Component({
  selector: 'app-ai-chat',
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './ai-chat.html',
  styleUrl: './ai-chat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChat implements OnDestroy {
  private readonly hub = inject(AssistantHubService);
  private subscription: Subscription | null = null;

  protected readonly answer = signal('');
  protected readonly streaming = signal(false);
  protected readonly error = signal<string | null>(null);

  protected ask(question: string): void {
    const trimmed = question.trim();
    if (!trimmed || this.streaming()) {
      return;
    }

    this.subscription?.unsubscribe();
    this.answer.set('');
    this.error.set(null);
    this.streaming.set(true);

    this.subscription = this.connectThenAsk(trimmed);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Returns the outer Subscription synchronously so ask()/ngOnDestroy() have
   * something to hold onto immediately. If that outer subscription is
   * unsubscribed before connect() resolves, RxJS runs the inner teardown the
   * moment it's `.add()`-ed to an already-closed Subscription - so a fast
   * re-ask or a navigate-away mid-connect can't leak a stream.
   */
  private connectThenAsk(question: string): Subscription {
    const subscription = new Subscription();

    // connect() is idempotent - safe to call on every ask(), same convention
    // as EventsHubService rather than tracking connected state here too.
    void this.hub
      .connect()
      .then(() => {
        subscription.add(
          this.hub.ask(question).subscribe({
            next: (chunk) => this.answer.update((current) => current + chunk),
            complete: () => this.streaming.set(false),
            error: (err: unknown) => {
              this.error.set(err instanceof Error ? err.message : 'Stream failed.');
              this.streaming.set(false);
            },
          }),
        );
      })
      .catch((err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Could not connect.');
        this.streaming.set(false);
      });

    return subscription;
  }
}
