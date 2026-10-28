import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameApiService } from '../../services/game-api.service';
import { GameService } from '../../services/game.service';
import { WordList } from '../../models/models';

@Component({
  selector: 'app-word-lists',
  imports: [RouterLink],
  templateUrl: './word-lists.component.html',
  styleUrl: './word-lists.component.css',
})
export class WordListsComponent {
  readonly auth = inject(AuthService);
  private readonly gameApi = inject(GameApiService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly lists = signal<WordList[] | null>(null);
  readonly maxLists = signal(20);
  readonly loadError = signal('');

  /** null: form closed; '': creating; otherwise the id being edited. */
  readonly editing = signal<string | null>(null);
  readonly name = signal('');
  readonly words = signal('');
  readonly formError = signal('');
  readonly saving = signal(false);
  readonly confirmDelete = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.auth.loading() && this.auth.isAuthenticated()) void this.load();
    });
  }

  async load(): Promise<void> {
    this.loadError.set('');
    const res = await this.gameApi.getLearn();
    if (res.success && res.data) {
      this.lists.set(res.data.lists);
      this.maxLists.set(res.data.maxLists);
    } else {
      this.loadError.set(res.error || 'Could not load your lists');
    }
  }

  openNew(): void {
    this.editing.set('');
    this.name.set('');
    this.words.set('');
    this.formError.set('');
  }

  openEdit(list: WordList): void {
    this.editing.set(list.id);
    this.name.set(list.name);
    this.words.set(list.words.join(' '));
    this.formError.set('');
  }

  closeForm(): void {
    this.editing.set(null);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const body = { name: this.name(), words: this.words() };
    const id = this.editing();
    const res = id ? await this.gameApi.updateWordList(id, body) : await this.gameApi.createWordList(body);
    this.saving.set(false);
    if (!res.success) {
      this.formError.set(res.error || 'Could not save the list');
      return;
    }
    this.editing.set(null);
    await this.load();
  }

  async remove(list: WordList): Promise<void> {
    const res = await this.gameApi.deleteWordList(list.id);
    this.confirmDelete.set(null);
    if (res.success) await this.load();
    else this.loadError.set(res.error || 'Could not delete the list');
  }

  async practice(list: WordList): Promise<void> {
    const res = await this.game.startPractice('list', list.id, `List · ${list.name}`);
    if (res.success) void this.router.navigate(['/play/practice']);
    else this.loadError.set(res.error || 'Could not start practice');
  }

  onInput(target: 'name' | 'words', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    (target === 'name' ? this.name : this.words).set(value);
  }
}
