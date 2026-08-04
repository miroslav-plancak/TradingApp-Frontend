import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Port of the original console's toast system.
 *
 * Effects call this for user-visible outcomes; nothing else in the app should
 * open a snackbar directly, so message style stays consistent across features.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'notification-success', 4000, 'polite');
  }

  info(message: string): void {
    this.open(message, 'notification-info', 4000, 'polite');
  }

  /** Errors stay up longer and interrupt screen readers — they need acting on. */
  error(message: string): void {
    this.open(message, 'notification-error', 10000, 'assertive');
  }

  private open(
    message: string,
    panelClass: string,
    duration: number,
    politeness: 'polite' | 'assertive',
  ): void {
    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass,
      politeness,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
