import { Directive, computed, input } from '@angular/core';

const STAFF = ['moderator', 'admin', 'founder'] as const;
type StaffRole = (typeof STAFF)[number];

const LABELS: Record<StaffRole, string> = { moderator: 'Moderator', admin: 'Admin', founder: 'Founder' };

/**
 * Puts a ring around an avatar for staff, coloured by rank (styles.css:
 * moderator dashed teal, admin solid purple, founder gold with a glow).
 * Anyone else, or no role, gets nothing. The ring is not the only cue: it
 * differs in line style too, and the hover text names the rank.
 *
 *   <img class="avatar" [appStaffRing]="player.role" />
 */
@Directive({
  selector: '[appStaffRing]',
  host: {
    '[attr.data-staff]': 'staff()',
    '[attr.title]': 'label()',
  },
})
export class StaffRingDirective {
  readonly role = input<string | null | undefined>(undefined, { alias: 'appStaffRing' });

  readonly staff = computed<StaffRole | null>(() => {
    const role = this.role();
    return (STAFF as readonly string[]).includes(role ?? '') ? (role as StaffRole) : null;
  });

  readonly label = computed(() => {
    const staff = this.staff();
    return staff ? LABELS[staff] : null;
  });
}
