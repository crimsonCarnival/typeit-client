import { Injectable } from '@angular/core';
import {
  paragraph,
  article,
  lorem,
  addNouns,
  addAdjectives,
  addTemplates,
  setNouns,
  setAdjectives,
  setTemplates,
} from 'txtgen';

export interface GeneratorConfig {
  unit: 'sentence' | 'paragraph' | 'article';
  count: number;
}

export interface GeneratedText {
  text: string;
  totalWords: number;
}

// ---------------------------------------------------------------------------
// Vocabulary overrides
// ---------------------------------------------------------------------------

const NOUNS = [
  // Technology
  'software', 'algorithm', 'network', 'database', 'interface', 'protocol',
  'architecture', 'framework', 'infrastructure', 'encryption', 'bandwidth',
  'latency', 'recursion', 'abstraction', 'concurrency', 'deployment',
  'integration', 'authentication', 'visualization', 'automation', 'scalability',
  'pipeline', 'runtime', 'compiler', 'interpreter', 'kernel', 'middleware',
  'microservice', 'container', 'cluster', 'endpoint', 'payload', 'schema',
  // Science & knowledge
  'hypothesis', 'theory', 'evidence', 'analysis', 'synthesis', 'paradigm',
  'methodology', 'principle', 'observation', 'experiment', 'data', 'signal',
  'pattern', 'variable', 'entropy', 'catalyst', 'frequency', 'spectrum',
  'dimension', 'threshold', 'trajectory', 'equilibrium', 'feedback',
  // Culture & society
  'tradition', 'culture', 'narrative', 'language', 'identity', 'community',
  'institution', 'philosophy', 'ideology', 'movement', 'legacy', 'heritage',
  'influence', 'perspective', 'dialogue', 'consensus', 'reform', 'revolution',
  // Business & craft
  'strategy', 'process', 'workflow', 'iteration', 'prototype', 'leadership',
  'collaboration', 'innovation', 'expertise', 'craftsmanship', 'discipline',
  'accountability', 'transparency', 'momentum', 'alignment', 'milestone',
  // Abstract concepts
  'clarity', 'complexity', 'simplicity', 'elegance', 'precision', 'coherence',
  'resilience', 'creativity', 'curiosity', 'wisdom', 'integrity', 'ambition',
  'consciousness', 'intuition', 'reasoning', 'imagination', 'memory',
  'attention', 'perception', 'judgment', 'knowledge', 'understanding',
  'context', 'nuance', 'foundation', 'boundary', 'constraint', 'potential',
  'capability', 'uncertainty', 'risk', 'opportunity', 'growth', 'change',
  'transformation', 'evolution', 'discovery', 'adaptation', 'balance',
];

const ADJECTIVES = [
  'precise', 'elegant', 'robust', 'scalable', 'efficient', 'reliable',
  'dynamic', 'adaptive', 'coherent', 'structured', 'complex', 'nuanced',
  'abstract', 'fundamental', 'essential', 'critical', 'innovative',
  'iterative', 'recursive', 'parallel', 'distributed', 'asynchronous',
  'optimized', 'integrated', 'automated', 'sustainable', 'flexible',
  'modular', 'composable', 'reusable', 'observable', 'measurable',
  'quantifiable', 'empirical', 'theoretical', 'practical', 'intuitive',
  'deliberate', 'intentional', 'systematic', 'methodical', 'analytical',
  'collaborative', 'transparent', 'accountable', 'consistent', 'balanced',
  'purposeful', 'meaningful', 'impactful', 'transformative', 'progressive',
  'incremental', 'continuous', 'universal', 'collective', 'independent',
  'immutable', 'declarative', 'functional', 'reactive', 'concurrent',
  'deterministic', 'probabilistic', 'hierarchical', 'relational', 'emergent',
  'profound', 'subtle', 'compelling', 'rigorous', 'meticulous', 'profound',
];

const TEMPLATES = [
  // Observation / definition
  '{{a_noun}} reveals more about its maker than its user',
  'call it {{noun}}, call it {{noun}} — the outcome rarely cares about the label',
  '{{a_noun}} is a promise the {{noun}} has to keep',
  'the difference between {{noun}} and {{noun}} shows up under pressure',
  '{{an_adjective}} {{noun}} is just {{noun}} that hasn\'t failed yet',

  // Relationship / causation
  '{{noun}} follows attention; whatever gets measured gets {{noun}}',
  'weak {{noun}} hides inside strong {{noun}} until something breaks',
  'give {{noun}} enough time and it becomes {{noun}}',
  '{{noun}} borrows against future {{noun}}, whether or not anyone notices',
  'change the {{noun}} and the {{noun}} changes with it, eventually',

  // Process / how things work
  'the first draft of {{noun}} is rarely the last word on {{noun}}',
  '{{an_adjective}} {{noun}} gets rebuilt more often than it gets repaired',
  'skipping {{noun}} now just moves the cost into later {{noun}}',
  'the fastest way to understand {{noun}} is to try to break it',
  '{{noun}} matures the same way {{noun}} does: slowly, then all at once',

  // Contrast / nuance
  '{{an_adjective}} {{noun}} and {{an_adjective}} {{noun}} rarely arrive together',
  'not all {{noun}} is created equal, even when it looks the same on paper',
  '{{noun}} that scales is not the same as {{noun}} that lasts',
  'the appearance of {{noun}} is not the same as the presence of {{noun}}',
  'cheap {{noun}} and cheap {{noun}} tend to come from the same shortcuts',

  // Philosophy / principle
  '{{noun}} is a decision made repeatedly, not once',
  'the quality of {{noun}} is set long before anyone asks about {{noun}}',
  'you inherit the {{noun}} of whoever came before you',
  '{{an_adjective}} {{noun}} outlives {{an_adjective}} intention',
  'nobody remembers the {{noun}}; everyone remembers the {{noun}} it left behind',

  // Everyday observations
  '{{noun}} is easiest to ignore right before it becomes {{noun}}',
  'the questions people ask about {{noun}} say more than the answers about {{noun}}',
  '{{an_adjective}} habits around {{noun}} beat {{an_adjective}} plans for {{noun}}',
  'good {{noun}} looks boring; bad {{noun}} looks exciting until it doesn\'t',
  '{{noun}} spreads faster than {{noun}}, for better or worse',
  // Observation / definition
  '{{a_noun}} is only as good as the {{noun}} behind it',
  'the strength of {{a_noun}} depends entirely on its underlying {{noun}}',
  '{{a_noun}} without {{noun}} is like a map without a destination',
  'good {{noun}} is the foundation of every {{an_adjective}} system',
  'the line between {{noun}} and {{noun}} is often thinner than expected',
  '{{a_noun}} is best understood as {{a_noun}} in motion',
  'what looks like {{noun}} from a distance is often just {{noun}} in disguise',
  'the most {{adjective}} solutions emerge from {{an_adjective}} understanding of the problem',
  '{{noun}} and {{noun}} are two sides of the same coin',
  'behind every {{adjective}} product is {{an_adjective}} attention to {{noun}}',
  // Relationship / causation
  'the relationship between {{noun}} and {{a_noun}} defines the shape of the whole',
  '{{noun}} shapes {{a_noun}} in ways we rarely stop to examine',
  'without {{noun}}, {{a_noun}} quickly loses its meaning',
  'more {{noun}} does not always lead to better {{noun}}',
  '{{an_adjective}} {{noun}} enables {{an_adjective}} kind of {{noun}}',
  '{{noun}} emerges naturally when {{noun}} and {{noun}} are properly aligned',
  'the absence of {{noun}} often reveals how much we relied on it',
  'too much {{noun}} can be just as harmful as too little {{noun}}',
  'reducing {{noun}} usually increases {{noun}}, and vice versa',
  '{{noun}} is what allows {{noun}} to scale without breaking',
  // Process / how things work
  'building {{an_adjective}} {{noun}} starts with asking the right questions',
  'real {{noun}} comes from consistent practice, not from sudden {{noun}}',
  'most {{noun}} problems are really {{noun}} problems in disguise',
  '{{an_adjective}} {{noun}} rarely survives contact with {{an_adjective}} {{noun}}',
  'the hardest part of {{noun}} is knowing when to stop adding more {{noun}}',
  'a small improvement in {{noun}} compounds into significant gains in {{noun}}',
  'clarity of {{noun}} makes every other aspect of {{noun}} easier',
  'the goal of {{noun}} is to make {{noun}} feel effortless',
  '{{noun}} tends to improve the moment you start measuring it',
  'sustainable {{noun}} requires investing in {{noun}} before it becomes urgent',
  // Contrast / nuance
  'speed and {{noun}} are not opposites; they both require {{an_adjective}} {{noun}}',
  '{{noun}} without {{noun}} produces output but not results',
  'the best {{noun}} often feels obvious in retrospect but {{an_adjective}} in practice',
  'simple {{noun}} is harder to achieve than {{an_adjective}} one',
  '{{an_adjective}} solution is not always {{an_adjective}} one',
  'local {{noun}} and global {{noun}} can point in opposite directions',
  'optimizing for {{noun}} alone often sacrifices {{noun}} along the way',
  'great {{noun}} leaves room for {{noun}} to breathe',
  'what works for small {{noun}} breaks at the scale of large {{noun}}',
  'early {{noun}} is worth more than late {{noun}}, even if imperfect',
  // Philosophy / principle
  'every {{noun}} reflects the values of the people who built it',
  '{{noun}} forces clarity by making every assumption visible',
  'the purpose of {{noun}} is not {{noun}} itself, but what it enables',
  '{{an_adjective}} {{noun}} asks better questions rather than providing all the answers',
  'true {{noun}} is indistinguishable from {{noun}} that has been deeply internalized',
  'you cannot improve {{noun}} you do not understand',
  '{{noun}} is a conversation between the present and the future',
  'the best time to address {{noun}} was earlier; the second best time is now',
  '{{an_adjective}} {{noun}} adapts to new information without losing its core purpose',
  'every constraint on {{noun}} is also an invitation to rethink {{noun}}',
  // Everyday observations
  'people underestimate how much {{noun}} influences everyday {{noun}}',
  'small details in {{noun}} accumulate into large differences in {{noun}}',
  'the tools we use for {{noun}} gradually shape how we think about {{noun}}',
  'most failures in {{noun}} can be traced back to neglected {{noun}}',
  'the words we use for {{noun}} reveal what we actually believe about it',
  '{{an_adjective}} {{noun}} changes the experience of everyone around it',
  'familiarity with {{noun}} can become an obstacle to seeing it clearly',
  '{{noun}} thrives in environments where {{noun}} is genuinely valued',
  'the fastest path through {{noun}} is not always the most direct one',
  '{{noun}} done well is rarely noticed; {{noun}} done poorly is impossible to ignore',
];

// Apply vocabulary on module load (runs once at app startup)
setNouns(NOUNS);
setAdjectives(ADJECTIVES);
setTemplates(TEMPLATES);

// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class TextGeneratorService {

  /**
   * Generates text using txtgen based on the given unit and count.
   * - sentence: generates `count` sentences (paragraph(count))
   * - paragraph: generates `count` paragraphs joined by a space
   * - article: generates an article of `count` paragraphs
   */
  generate(config: GeneratorConfig): GeneratedText {
    let text: string;

    switch (config.unit) {
      case 'sentence':
        // paragraph(N) generates N sentences as a single joined block
        text = paragraph(config.count);
        break;
      case 'paragraph':
        text = Array.from({ length: config.count }, () => paragraph()).join(' ');
        break;
      case 'article':
        text = article(config.count);
        break;
      default:
        text = paragraph(3);
    }

    return { text: text.trim(), totalWords: this.countWords(text) };
  }

  /** Generates lorem ipsum text with word count between min and max. */
  generateLorem(min: number, max: number): GeneratedText {
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    const text = lorem(safeMin, safeMax);
    return { text, totalWords: this.countWords(text) };
  }

  vocabState = { nouns: '', adjectives: '', templates: '' };

  /** Adds custom vocabulary on top of the defaults above; does not persist across page reloads. */
  extendVocabulary(nounsRaw: string, adjectivesRaw: string, templatesRaw: string): void {
    this.vocabState = { nouns: nounsRaw, adjectives: adjectivesRaw, templates: templatesRaw };

    const nouns = nounsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const adjectives = adjectivesRaw.split(',').map(s => s.trim()).filter(Boolean);
    const templates = templatesRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (nouns.length)      addNouns(nouns);
    if (adjectives.length) addAdjectives(adjectives);
    if (templates.length)  addTemplates(templates);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}
