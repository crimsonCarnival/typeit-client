import { AfterViewInit, Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.css',
})
export class AuthModalComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly initialMode = input<'login' | 'register'>('login');
  readonly close = output<void>();

  mode: 'login' | 'register' = 'login';
  username = '';
  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  readonly formError = signal('');
  readonly isSubmitting = signal(false);

  readonly displayError = computed(() => this.formError() || this.auth.error() || '');

  constructor() {
    // Inputs are not populated until after construction, so sync the initial
    // mode reactively instead of reading the input in a field initializer.
    effect(() => {
      this.mode = this.initialMode();
    });
  }

  ngAfterViewInit(): void {
    this.focusFirstField();
  }

  // Game shortcuts listen on `document` and swallow Tab/Esc; keep keys inside
  // the dialog so Tab moves between fields and Esc closes the dialog instead.
  handleKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }

  handleChange(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'username') this.username = value;
    else if (field === 'displayName') this.displayName = value;
    else if (field === 'email') this.email = value;
    else if (field === 'password') this.password = value;
    else if (field === 'confirmPassword') this.confirmPassword = value;
    this.formError.set('');
    this.auth.clearError();
  }

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.formError.set('');
    this.isSubmitting.set(true);

    try {
      if (this.mode === 'register') {
        if (!this.username.trim()) {
          this.formError.set('Username is required');
          return;
        }
        if (!this.email.trim()) {
          this.formError.set('Email is required');
          return;
        }
        if (this.password.length < 6) {
          this.formError.set('Password must be at least 6 characters');
          return;
        }
        if (this.password !== this.confirmPassword) {
          this.formError.set('Passwords do not match');
          return;
        }

        const result = await this.auth.register({
          username: this.username,
          displayName: this.displayName.trim() || this.username,
          email: this.email,
          password: this.password,
        });

        if (result.success) {
          this.closeModal();
        }
      } else {
        const identifier = this.email || this.username;
        if (!identifier.trim()) {
          this.formError.set('Username or email is required');
          return;
        }
        if (!this.password) {
          this.formError.set('Password is required');
          return;
        }

        const result = await this.auth.login({ identifier, password: this.password });

        if (result.success) {
          this.closeModal();
        }
      }
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetForm(): void {
    this.username = '';
    this.displayName = '';
    this.email = '';
    this.password = '';
    this.confirmPassword = '';
    this.showPassword = false;
    this.formError.set('');
    this.auth.clearError();
  }

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.resetForm();
    // The field set changes with the mode; wait for the re-render before focusing.
    setTimeout(() => this.focusFirstField());
  }

  closeModal(): void {
    this.close.emit();
    this.resetForm();
  }

  handleOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  private focusFirstField(): void {
    this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
  }
}
