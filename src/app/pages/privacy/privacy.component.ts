import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

/** Privacy policy: what is kept, why, and how to change it. Kept in step with what the code does. */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.css',
})
export class PrivacyComponent {
  /** From the server (CONTACT_EMAIL); empty points to the about page instead. */
  readonly contactEmail = signal('');

  constructor() {
    void fetch(`${environment.apiUrl}/site`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => this.contactEmail.set(body?.data?.contactEmail ?? ''))
      .catch(() => {});
  }
}
