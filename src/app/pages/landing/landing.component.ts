import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';

// Time limit set by "Your first test takes 30 seconds" (the copy promises it).
const FIRST_TEST_SECONDS = 30;

/** Marketing landing page at / (redesign/Main.dc.html). */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly metrics = [
    { title: 'WPM', text: 'Net speed: correct words per minute. The number you screenshot.' },
    { title: 'Raw WPM', text: 'Everything you typed, mistakes included. The gap to WPM is what errors cost you.' },
    { title: 'Accuracy', text: 'Correct keystrokes out of every key you pressed.' },
    { title: 'Consistency', text: 'How even your pace stays from first key to last. Bursts and stalls pull it down.' },
    { title: 'AFK time', text: 'Pauses are logged as AFK periods, so you see every moment you froze.' },
  ];

  readonly formats = [
    { title: 'Words', text: 'A fixed number of random words. Finish them all.', chips: ['25', '50', '75', '100', 'Custom'], account: false },
    { title: 'Time limit', text: "Put a clock on any run. When it hits zero, you're done.", chips: ['30s', '60s', '90s', '120s', 'Custom'], account: false },
    { title: 'Phrases', text: 'Real sentences instead of word salad, closer to how you actually type.', chips: [], account: true },
    { title: 'Modifiers', text: 'Mix punctuation and numbers into any run. Each combo gets its own stats.', chips: ['.?! Punctuation', '123 Numbers'], account: true },
  ];

  readonly perks = [
    'Personal bests for WPM, score and accuracy',
    'Performance history across sessions',
    'Splits by time limit, word count, mode and modifiers',
    'Total time typing and time spent AFK',
    'Followers and following',
  ];

  startFirstTest(): void {
    this.game.setTimeMax(FIRST_TEST_SECONDS);
    void this.router.navigate(['/play']);
  }
}
