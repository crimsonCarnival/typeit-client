import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminApiService } from '../../services/admin-api.service';
import { TimezoneService } from '../../services/timezone.service';
import { ContextMenuDirective } from '../../components/menu/context-menu.directive';
import { KebabMenuComponent } from '../../components/menu/kebab-menu.component';
import { MenuItem } from '../../components/menu/menu.service';
import { StepperComponent } from '../../components/stepper/stepper.component';
import { AdminAudit, AdminRoom, AdminUser, PermissionCatalog, Role } from '../../models/models';

type Tab = 'users' | 'races' | 'audit';
type DialogKind = 'warn' | 'deactivate' | 'ban' | 'reactivate' | 'profile' | 'role' | 'permissions' | 'xp';

const ROLES: Role[] = ['user', 'moderator', 'admin', 'founder'];
// Higher outranks lower (mirrors the server's config/permissions.js, which enforces it).
const RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2, founder: 3 };
const PROFILE_FIELDS = [
  { id: 'displayName', label: 'Display name' },
  { id: 'bio', label: 'Bio' },
  { id: 'avatar', label: 'Avatar' },
];
const AUDIT_LABELS: Record<string, string> = {
  'user.warn': 'warned',
  'user.role': 'changed the role of',
  'user.ban': 'banned',
  'user.deactivate': 'deactivated',
  'user.reactivate': 'reactivated',
  'user.permissions': 'changed the permissions of',
  'user.profile-reset': 'reset the profile of',
  'user.xp': 'granted XP to',
  'user.delete': 'deleted',
  'race.kick': 'removed from a race',
  'race.mute': 'muted in a race',
  'race.unmute': 'unmuted in a race',
};
const DIALOG_TITLES: Record<DialogKind, string> = {
  warn: 'Warn',
  deactivate: 'Deactivate',
  ban: 'Ban',
  reactivate: 'Reactivate',
  profile: 'Reset profile',
  role: 'Change role',
  permissions: 'Edit permissions',
  xp: 'Grant XP',
};
/** Permissions only admins and founders can hold; the editor shows them but cannot change them. */
const ADMINS_ONLY = ['users.role', 'users.permissions', 'users.xp'];

/**
 * Admin area: users, live race rooms and the audit log. Each row has a ⋯
 * menu and the same menu on right-click; actions that need input open a
 * dialog. What shows follows the permissions the server reports for the
 * signed-in player; the server still checks every action.
 */
@Component({
  selector: 'app-admin',
  imports: [ContextMenuDirective, KebabMenuComponent, StepperComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly tz = inject(TimezoneService);
  private readonly router = inject(Router);

  readonly roles = ROLES;
  readonly profileFields = PROFILE_FIELDS;
  readonly adminsOnly = ADMINS_ONLY;

  readonly tabs = computed(() =>
    ([
      { id: 'users', label: 'Users', show: this.auth.can('users.view') },
      { id: 'races', label: 'Race rooms', show: this.auth.can('race.moderate') },
      { id: 'audit', label: 'Audit log', show: this.auth.can('audit.view') },
    ] as { id: Tab; label: string; show: boolean }[]).filter((t) => t.show)
  );
  readonly tab = signal<Tab>('users');

  /** One line at the top: what just happened, or what went wrong. */
  readonly message = signal<{ text: string; error: boolean } | null>(null);
  readonly busy = signal(false);

  // Users
  readonly users = signal<AdminUser[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly search = signal('');
  readonly roleFilter = signal('');
  readonly statusFilter = signal('');
  readonly catalog = signal<PermissionCatalog | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Races
  readonly rooms = signal<AdminRoom[]>([]);
  readonly raceReason = signal('');

  // Audit
  readonly audit = signal<AdminAudit | null>(null);
  readonly auditPage = signal(1);

  // The open dialog and its form
  readonly dialog = signal<{ kind: DialogKind; user: AdminUser } | null>(null);
  readonly reason = signal('');
  readonly xpAmount = signal('');
  readonly roleChoice = signal<Role>('user');
  readonly resetFields = signal<Set<string>>(new Set());
  /** Permissions ticked in the editor: what the player would effectively hold. */
  readonly effective = signal<Set<string>>(new Set());
  private readonly dialogEl = viewChild<ElementRef<HTMLElement>>('dialogEl');
  private opener: HTMLElement | null = null;

  private readonly myRank = computed(() => RANK[(this.auth.user()?.role as Role) ?? 'user'] ?? 0);
  /** Roles the signed-in player may give: below their own, and never founder (that comes from the server settings). */
  readonly assignableRoles = computed(() => ROLES.filter((r) => r !== 'founder' && RANK[r] < this.myRank()));
  readonly dialogTitle = computed(() => {
    const d = this.dialog();
    return d ? `${DIALOG_TITLES[d.kind]}: ${d.user.username}` : '';
  });

  /** Permissions a role starts with, for the editor. */
  private baseOf(role: Role): Set<string> {
    return new Set(this.catalog()?.roles[role] ?? []);
  }

  readonly dialogBase = computed(() => this.baseOf(this.dialog()?.user.role ?? 'user'));

  /** Whole points from the XP field, or null when it is not a usable amount. */
  readonly xpPoints = computed(() => {
    const n = Number(this.xpAmount());
    return Number.isInteger(n) && n >= 1 && n <= 50_000 ? n : null;
  });

  /** Whether the open dialog has what it needs to be sent. */
  readonly canSubmit = computed(() => {
    const d = this.dialog();
    if (!d || this.busy()) return false;
    const why = this.reason().trim().length > 0;
    switch (d.kind) {
      case 'warn': return why;
      case 'profile': return why && this.resetFields().size > 0;
      case 'xp': return why && this.xpPoints() !== null;
      case 'role': return this.roleChoice() !== d.user.role;
      default: return true;
    }
  });

  constructor() {
    effect(() => {
      const first = this.tabs()[0];
      if (first && !this.tabs().some((t) => t.id === this.tab())) this.tab.set(first.id);
    });
    effect(() => {
      if (this.auth.loading() || !this.auth.isAuthenticated()) return;
      void this.loadUsers();
      void this.api.permissions().then((res) => res.data && this.catalog.set(res.data));
    });
    // Move focus into a dialog when it opens.
    effect(() => {
      const el = this.dialogEl()?.nativeElement;
      if (el) queueMicrotask(() => (el.querySelector<HTMLElement>('textarea, input, select') ?? el).focus());
    });
  }

  show(tab: Tab): void {
    this.tab.set(tab);
    this.message.set(null);
    if (tab === 'races') void this.loadRooms();
    if (tab === 'audit') void this.loadAudit(1);
  }

  private fail(error: string | undefined): void {
    this.message.set({ text: error || 'That did not work', error: true });
  }

  private ok(text: string): void {
    this.message.set({ text, error: false });
  }

  // ---- users

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadUsers(1), 300);
  }

  onFilter(kind: 'role' | 'status', event: Event): void {
    (kind === 'role' ? this.roleFilter : this.statusFilter).set((event.target as HTMLSelectElement).value);
    void this.loadUsers(1);
  }

  async loadUsers(page = this.page()): Promise<void> {
    if (!this.auth.can('users.view')) return;
    const res = await this.api.users(page, { search: this.search().trim(), role: this.roleFilter(), status: this.statusFilter() });
    if (!res.success || !res.data) return this.fail(res.error);
    this.users.set(res.data.users);
    this.page.set(res.data.pagination.page);
    this.pages.set(Math.max(1, res.data.pagination.pages));
    this.total.set(res.data.pagination.total);
  }

  joined(u: AdminUser): string {
    return this.tz.date(u.createdAt);
  }

  isSelf(u: AdminUser): boolean {
    return u._id === this.auth.user()?.id;
  }

  /** The signed-in player outranks this one (and it is not a founder, who nobody can act on). */
  canAct(u: AdminUser): boolean {
    return !this.isSelf(u) && u.role !== 'founder' && RANK[u.role] < this.myRank();
  }

  /** The ⋯ and right-click menu for a player: only what this admin is allowed to do to them. */
  menuFor = (u: AdminUser): MenuItem[] => {
    const items: MenuItem[] = [
      { label: u.username, heading: true },
      { label: 'View profile', action: () => void this.router.navigate(['/user', u._id]) },
      { label: 'Copy user ID', action: () => void navigator.clipboard?.writeText(u._id).catch(() => undefined) },
    ];
    const acts: MenuItem[] = [];
    if (this.canAct(u) && this.auth.can('users.moderate')) {
      acts.push({ label: 'Warn…', action: () => this.openDialog('warn', u) });
      if (u.status === 'active') {
        acts.push({ label: 'Deactivate…', action: () => this.openDialog('deactivate', u) });
        acts.push({ label: 'Ban…', danger: true, action: () => this.openDialog('ban', u) });
      } else {
        acts.push({ label: 'Reactivate…', action: () => this.openDialog('reactivate', u) });
      }
    }
    if (this.canAct(u) && this.auth.can('content.moderate')) acts.push({ label: 'Reset profile…', action: () => this.openDialog('profile', u) });
    if (this.canAct(u) && this.auth.can('users.role')) acts.push({ label: 'Change role…', action: () => this.openDialog('role', u) });
    if (this.canAct(u) && this.auth.can('users.permissions')) acts.push({ label: 'Edit permissions…', action: () => this.openDialog('permissions', u) });
    if (!this.isSelf(u) && this.auth.can('users.xp')) acts.push({ label: 'Grant XP…', action: () => this.openDialog('xp', u) });
    if (acts.length) items.push({ separator: true }, ...acts);
    else if (!this.isSelf(u)) items.push({ separator: true }, { label: 'No actions available', disabled: true, hint: 'higher rank' });
    return items;
  };

  // ---- dialog

  openDialog(kind: DialogKind, user: AdminUser): void {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.message.set(null);
    this.reason.set('');
    this.xpAmount.set('');
    this.resetFields.set(new Set());
    this.roleChoice.set(user.role);
    const held = new Set(this.baseOf(user.role));
    for (const p of user.permissionGrants ?? []) held.add(p);
    for (const p of user.permissionRevokes ?? []) held.delete(p);
    this.effective.set(held);
    this.dialog.set({ kind, user });
  }

  closeDialog(): void {
    if (this.busy()) return;
    this.dialog.set(null);
    this.opener?.focus?.();
  }

  onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  onXpAmount(event: Event): void {
    this.xpAmount.set((event.target as HTMLInputElement).value);
  }

  onRoleChoice(event: Event): void {
    this.roleChoice.set((event.target as HTMLSelectElement).value as Role);
  }

  togglePermission(id: string, event: Event): void {
    const next = new Set(this.effective());
    if ((event.target as HTMLInputElement).checked) next.add(id);
    else next.delete(id);
    this.effective.set(next);
  }

  toggleResetField(id: string, event: Event): void {
    const next = new Set(this.resetFields());
    if ((event.target as HTMLInputElement).checked) next.add(id);
    else next.delete(id);
    this.resetFields.set(next);
  }

  async submit(): Promise<void> {
    const d = this.dialog();
    if (!d || !this.canSubmit()) return;
    const u = d.user;
    this.busy.set(true);
    let res: { success: boolean; error?: string };
    let done = '';
    switch (d.kind) {
      case 'warn':
        res = await this.api.warn(u._id, this.reason());
        done = `Warned ${u.username}.`;
        break;
      case 'deactivate':
      case 'ban':
      case 'reactivate': {
        const status = d.kind === 'ban' ? 'banned' : d.kind === 'deactivate' ? 'deactivated' : 'active';
        res = await this.api.setStatus(u._id, status, this.reason());
        done = d.kind === 'reactivate' ? `Reactivated ${u.username}.` : `${d.kind === 'ban' ? 'Banned' : 'Deactivated'} ${u.username}.`;
        break;
      }
      case 'profile':
        res = await this.api.resetProfile(u._id, [...this.resetFields()], this.reason());
        done = `Reset ${[...this.resetFields()].join(', ')} for ${u.username}.`;
        break;
      case 'role':
        res = await this.api.setRole(u._id, this.roleChoice());
        done = `${u.username} is now ${this.roleChoice()}.`;
        break;
      case 'permissions': {
        const base = this.dialogBase();
        const held = this.effective();
        res = await this.api.setPermissions(u._id, [...held].filter((p) => !base.has(p)), [...base].filter((p) => !held.has(p)));
        done = `Saved permissions for ${u.username}.`;
        break;
      }
      case 'xp': {
        const points = this.xpPoints()!;
        const out = await this.api.grantXp(u._id, points, this.reason());
        res = out;
        done = out.data && out.data.level > out.data.levelBefore
          ? `Granted ${points.toLocaleString()} XP to ${u.username}: now level ${out.data.level}.`
          : `Granted ${points.toLocaleString()} XP to ${u.username}.`;
        break;
      }
    }
    this.busy.set(false);
    if (!res.success) return this.fail(res.error);
    this.dialog.set(null);
    this.ok(done);
    await this.loadUsers();
    this.opener?.focus?.();
  }

  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeDialog();
    }
  }

  // ---- races

  async loadRooms(): Promise<void> {
    const res = await this.api.rooms();
    if (res.success && res.data) this.rooms.set(res.data.rooms);
    else this.fail(res.error);
  }

  onRaceReason(event: Event): void {
    this.raceReason.set((event.target as HTMLInputElement).value);
  }

  roomPlayerMenu = (room: AdminRoom, p: AdminRoom['players'][number]): MenuItem[] => [
    { label: p.displayName, heading: true },
    { label: p.muted ? 'Unmute' : 'Mute', action: () => void this.moderate(room, p.userId, p.muted ? 'unmute' : 'mute') },
    { label: 'Remove from room', danger: true, action: () => void this.moderate(room, p.userId, 'kick') },
  ];

  async moderate(room: AdminRoom, userId: string, action: 'kick' | 'mute' | 'unmute'): Promise<void> {
    const res = await this.api.moderateRoom(room.code, action, userId, this.raceReason());
    if (!res.success) this.fail(res.error);
    else this.ok(action === 'kick' ? 'Player removed.' : action === 'mute' ? 'Player muted.' : 'Player unmuted.');
    await this.loadRooms();
  }

  // ---- audit

  async loadAudit(page: number): Promise<void> {
    const res = await this.api.audit(page);
    if (res.success && res.data) {
      this.audit.set(res.data);
      this.auditPage.set(page);
    } else this.fail(res.error);
  }

  describe(action: string): string {
    return AUDIT_LABELS[action] ?? action;
  }

  when(iso: string): string {
    return this.tz.dateTime(iso);
  }
}
