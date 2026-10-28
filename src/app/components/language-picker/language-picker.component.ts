import { Component, input, output } from '@angular/core';
import { CodeLanguage, GameMode, WordLanguage } from '../../models/models';

export type LanguagePatch = { language?: WordLanguage; codeLanguage?: CodeLanguage };

/** Words mode language, or code mode snippet language. Only English words are ranked. */
@Component({
  selector: 'app-language-picker',
  templateUrl: './language-picker.component.html',
})
export class LanguagePickerComponent {
  readonly gameMode = input<GameMode>('words');
  readonly language = input<WordLanguage>('english');
  readonly codeLanguage = input<CodeLanguage>('javascript');
  readonly disabled = input(false);
  readonly languageChange = output<LanguagePatch>();

  readonly languages: { id: WordLanguage; label: string }[] = [
    { id: 'english', label: 'English' },
    { id: 'spanish', label: 'Español' },
    { id: 'french', label: 'Français' },
    { id: 'german', label: 'Deutsch' },
    { id: 'portuguese', label: 'Português' },
    { id: 'italian', label: 'Italiano' },
  ];

  readonly codeLanguages: { id: CodeLanguage; label: string }[] = [
    { id: 'javascript', label: 'JS' },
    { id: 'python', label: 'Python' },
    { id: 'go', label: 'Go' },
    { id: 'rust', label: 'Rust' },
    { id: 'sql', label: 'SQL' },
    { id: 'bash', label: 'Bash' },
  ];

  onLanguage(event: Event): void {
    if (!this.disabled()) this.languageChange.emit({ language: (event.target as HTMLSelectElement).value as WordLanguage });
  }

  setCode(id: CodeLanguage): void {
    if (!this.disabled() && id !== this.codeLanguage()) this.languageChange.emit({ codeLanguage: id });
  }
}
