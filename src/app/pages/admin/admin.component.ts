import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminApiService } from '../../services/admin-api.service';
import { TimezoneService } from '../../services/timezone.service';
import { AdminAudit, AdminRoom, AdminUser, PermissionCatalog, Role } from '../../models/models';

type Tab = 'users' | 'races' | 'audit';
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

/**
 * Admin area: users, live race rooms and the audit log. What each tab and
 * button shows follows the permissions the server reports for the signed-in
 * player; the server still checks every action.
 */
@Component({
  selector: 'app-admin',
  imports: [RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly tz = inject(TimezoneService);

  readonly roles = ROLES;

  private readonly myRank = computed(() => RANK[(this.auth.user()?.role as Role) ?? 'user'] ?? 0);
  /** Roles the signed-in player may give: below their own, and never founder (that comes from the server settings). */
  readonly assignableRoles = computed(() => ROLES.filter((r) => r !== 'founder' && RANK[r] < this.myRank()));
  /** The selected player is below the signed-in one, so actions on them are possible at all. */
  readonly canActOnSelected = computed(() => {
    const s = this.selected();
    return !!s && s.role !== 'founder' && RANK[s.role] < this.myRank() && !this.isSelf();
  });
  readonly profileFields = PROFILE_FIELDS;

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
  readonly selected = signal<AdminUser | null>(null);
  readonly reason = signal('');
  readonly xpAmount = signal('');
  readonly catalog = signal<PermissionCatalog | null>(null);
  /** Permissions ticked in the editor: what the player would effectively hold. */
  readonly effective = signal<Set<string>>(new Set());
  readonly resetFields = signal<Set<string>>(new Set());
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Races
  readonly rooms = signal<AdminRoom[]>([]);

  // Audit
  readonly audit = signal<AdminAudit | null>(null);
  readonly auditPage = signal(1);

  /** Permissions a role starts with, for the editor. */
  readonly baseOf = computed(() => new Set(this.catalog()?.roles[this.selected()?.role ?? 'user'] ?? []));
  readonly selectedIsAdmin = computed(() => this.selected()?.role === 'admin');
  readonly isSelf = computed(() => this.selected()?._id === this.auth.user()?.id);

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

  select(user: AdminUser): void {
    this.selected.set(user);
    this.reason.set('');
    this.resetFields.set(new Set());
    this.message.set(null);
    const base = new Set(this.catalog()?.roles[user.role] ?? []);
    for (const p of user.permissionGrants ?? []) base.add(p);
    for (const p of user.permissionRevokes ?? []) base.delete(p);
    this.effective.set(base);
  }

  onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  /** Runs an action on the selected player, then refreshes the list and the panel. */
  private async act(run: (u: AdminUser) => Promise<{ success: boolean; error?: string; data?: unknown }>, done: string): Promise<void> {
    const user = this.selected();
    if (!user || this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    const res = await run(user);
    this.busy.set(false);
    if (!res.success) return this.fail(res.error);
    if (!this.message() || this.message()!.error) this.ok(done);
    this.reason.set('');
    await this.loadUsers();
    const fresh = this.users().find((u) => u._id === user._id);
    if (fresh) this.select(fresh);
  }

  onXpAmount(event: Event): void {
    this.xpAmount.set((event.target as HTMLInputElement).value);
  }

  /** Whole points from the field, or null when it is not a usable amount. */
  readonly xpPoints = computed(() => {
    const n = Number(this.xpAmount());
    return Number.isInteger(n) && n >= 1 && n <= 50_000 ? n : null;
  });

  async grantXp(): Promise<void> {
    const points = this.xpPoints();
    if (points === null) return;
    await this.act(async (u) => {
      const res = await this.api.grantXp(u._id, points, this.reason());
      if (res.success && res.data) this.xpAmount.set('');
      if (res.success && res.data && res.data.level > res.data.levelBefore) this.ok(`Granted ${points.toLocaleString()} XP: now level ${res.data.level}.`);
      return res;
    }, `Granted ${points.toLocaleString()} XP.`);
  }

  warn(): Promise<void> {
    return this.act((u) => this.api.warn(u._id, this.reason()), 'Warning sent.');
  }

  setStatus(status: 'active' | 'deactivated' | 'banned'): Promise<void> {
    const verb = { active: 'reactivated', deactivated: 'deactivated', banned: 'banned' }[status];
    return this.act((u) => this.api.setStatus(u._id, status, this.reason()), `Account ${verb}.`);
  }

  setRole(event: Event): Promise<void> {
    const role = (event.target as HTMLSelectElement).value as Role;
    return this.act((u) => this.api.setRole(u._id, role), `Role changed to ${role}.`);
  }

  togglePermission(id: string, event: Event): void {
    const next = new Set(this.effective());
    if ((event.target as HTMLInputElement).checked) next.add(id);
    else next.delete(id);
    this.effective.set(next);
  }

  savePermissions(): Promise<void> {
    const base = this.baseOf();
    const held = this.effective();
    const grants = [...held].filter((p) => !base.has(p));
    const revokes = [...base].filter((p) => !held.has(p));
    return this.act((u) => this.api.setPermissions(u._id, grants, revokes), 'Permissions saved.');
  }

  toggleResetField(id: string, event: Event): void {
    const next = new Set(this.resetFields());
    if ((event.target as HTMLInputElement).checked) next.add(id);
    else next.delete(id);
    this.resetFields.set(next);
  }

  resetProfile(): Promise<void> {
    return this.act((u) => this.api.resetProfile(u._id, [...this.resetFields()], this.reason()), 'Profile fields reset.');
  }

  // ---- races

  async loadRooms(): Promise<void> {
    const res = await this.api.rooms();
    if (res.success && res.data) this.rooms.set(res.data.rooms);
    else this.fail(res.error);
  }

  async moderate(room: AdminRoom, userId: string, action: 'kick' | 'mute' | 'unmute'): Promise<void> {
    const res = await this.api.moderateRoom(room.code, action, userId, this.reason());
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

  permissionLabel(id: string): string {
    return this.catalog()?.permissions.find((p) => p.id === id)?.description ?? id;
  }
}
