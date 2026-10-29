/**
 * Colour themes. Each one is six colours; every design token the app uses is
 * derived from them (applyTheme), so a new theme is one line here. The
 * server only checks that a theme id is well formed, so adding one needs no
 * server change.
 *
 *   bg      page background
 *   main    the theme's colour: buttons, caret, speed figures
 *   sub     secondary text and labels
 *   subAlt  cards, inputs, the typing box
 *   text    main text and typed letters
 *   error   mistakes
 */
export type Theme = { id: string; name: string; bg: string; main: string; sub: string; subAlt: string; text: string; error: string };

export const DEFAULT_THEME = 'crimson';

export const THEMES: Theme[] = [
  { id: 'crimson', name: 'crimson', bg: '#0a0a0b', main: '#c8102e', sub: '#a9a5ad', subAlt: '#141416', text: '#f2efea', error: '#ff3b4f' },
  { id: 'ocean', name: 'ocean', bg: '#0b1220', main: '#3fa7ff', sub: '#7d8fa9', subAlt: '#121c2e', text: '#e3ecf7', error: '#ff5d73' },
  { id: 'forest', name: 'forest', bg: '#0e1410', main: '#5cd65c', sub: '#869a88', subAlt: '#162019', text: '#e4efe4', error: '#ff6b6b' },
  { id: 'light', name: 'light', bg: '#f4f1ec', main: '#b00d28', sub: '#625e66', subAlt: '#ffffff', text: '#1d1b1f', error: '#d61f35' },
  { id: 'carbon', name: 'carbon', bg: '#313131', main: '#f66e0d', sub: '#616161', subAlt: '#2b2b2b', text: '#f5e6c8', error: '#e72d2d' },
  { id: 'slate-honey', name: 'slate honey', bg: '#323437', main: '#e2b714', sub: '#646669', subAlt: '#2c2e31', text: '#d1d0c5', error: '#ca4754' },
  { id: 'paper', name: 'paper', bg: '#eeeeee', main: '#444444', sub: '#b2b2b2', subAlt: '#dddddd', text: '#444444', error: '#d70000' },
  { id: 'midnight', name: 'midnight', bg: '#0b0e13', main: '#60759f', sub: '#394760', subAlt: '#141a24', text: '#9fadc6', error: '#c26170' },
  { id: 'nord', name: 'nord', bg: '#242933', main: '#88c0d0', sub: '#6d7686', subAlt: '#2e3440', text: '#eceff4', error: '#bf616a' },
  { id: 'nord-light', name: 'nord light', bg: '#eceff4', main: '#5e81ac', sub: '#8a96aa', subAlt: '#e1e5ec', text: '#2e3440', error: '#bf616a' },
  { id: 'dracula', name: 'dracula', bg: '#282a36', main: '#bd93f9', sub: '#6272a4', subAlt: '#20222c', text: '#f8f8f2', error: '#ff5555' },
  { id: 'gruvbox-dark', name: 'gruvbox dark', bg: '#282828', main: '#d79921', sub: '#665c54', subAlt: '#32302f', text: '#ebdbb2', error: '#fb4934' },
  { id: 'gruvbox-light', name: 'gruvbox light', bg: '#fbf1c7', main: '#689d6a', sub: '#a89984', subAlt: '#ebdbb2', text: '#3c3836', error: '#cc241d' },
  { id: 'solarized-dark', name: 'solarized dark', bg: '#002b36', main: '#859900', sub: '#2aa198', subAlt: '#073642', text: '#268bd2', error: '#d33682' },
  { id: 'solarized-light', name: 'solarized light', bg: '#fdf6e3', main: '#859900', sub: '#2aa198', subAlt: '#eee8d5', text: '#181819', error: '#d33682' },
  { id: 'monokai', name: 'monokai', bg: '#272822', main: '#f92672', sub: '#75715e', subAlt: '#2f302a', text: '#e2e2dc', error: '#fd971f' },
  { id: 'catppuccin', name: 'catppuccin', bg: '#1e1e2e', main: '#cba6f7', sub: '#7f849c', subAlt: '#181825', text: '#cdd6f4', error: '#f38ba8' },
  { id: 'catppuccin-latte', name: 'catppuccin latte', bg: '#eff1f5', main: '#8839ef', sub: '#8c8fa1', subAlt: '#e6e9ef', text: '#4c4f69', error: '#d20f39' },
  { id: 'tokyo-night', name: 'tokyo night', bg: '#1a1b26', main: '#7aa2f7', sub: '#565f89', subAlt: '#16161e', text: '#c0caf5', error: '#f7768e' },
  { id: 'rose-pine', name: 'rose pine', bg: '#191724', main: '#ebbcba', sub: '#6e6a86', subAlt: '#1f1d2e', text: '#e0def4', error: '#eb6f92' },
  { id: 'rose-pine-dawn', name: 'rose pine dawn', bg: '#faf4ed', main: '#d7827e', sub: '#9893a5', subAlt: '#fffaf3', text: '#575279', error: '#b4637a' },
  { id: 'everforest', name: 'everforest', bg: '#2d353b', main: '#a7c080', sub: '#859289', subAlt: '#343f44', text: '#d3c6aa', error: '#e67e80' },
  { id: 'one-dark', name: 'one dark', bg: '#282c34', main: '#61afef', sub: '#5c6370', subAlt: '#21252b', text: '#abb2bf', error: '#e06c75' },
  { id: 'github-dark', name: 'github dark', bg: '#0d1117', main: '#58a6ff', sub: '#6e7681', subAlt: '#161b22', text: '#c9d1d9', error: '#f85149' },
  { id: 'material', name: 'material', bg: '#263238', main: '#80cbc4', sub: '#4c6772', subAlt: '#1e282c', text: '#e6edf3', error: '#fb4934' },
  { id: 'synthwave', name: 'synthwave', bg: '#262335', main: '#f97e72', sub: '#848bbd', subAlt: '#241b2f', text: '#ffffff', error: '#fe4450' },
  { id: 'vaporwave', name: 'vaporwave', bg: '#a4a7ea', main: '#e368da', sub: '#c1c4f5', subAlt: '#9a9de1', text: '#f1ebf1', error: '#28cbe0' },
  { id: 'bento', name: 'bento', bg: '#2d394d', main: '#ff7a90', sub: '#4a768d', subAlt: '#263042', text: '#fffaf8', error: '#ee2a3a' },
  { id: 'botanical', name: 'botanical', bg: '#7b9c98', main: '#eaf1f3', sub: '#495755', subAlt: '#6f8f8b', text: '#eaf1f3', error: '#f6c9b4' },
  { id: 'aurora', name: 'aurora', bg: '#011926', main: '#00e980', sub: '#245c69', subAlt: '#00293d', text: '#fff7e6', error: '#b94da1' },
  { id: 'beach', name: 'beach', bg: '#ffeead', main: '#96ceb4', sub: '#ffcc5c', subAlt: '#fde39b', text: '#5b7869', error: '#ff6f69' },
  { id: 'honey', name: 'honey', bg: '#f2aa00', main: '#fff546', sub: '#a66b00', subAlt: '#e19e00', text: '#f3eecb', error: '#df3333' },
  { id: 'lavender', name: 'lavender', bg: '#ada6c2', main: '#e4e3e9', sub: '#e4e3e9', subAlt: '#a19ab6', text: '#2f2a41', error: '#ca4754' },
  { id: 'matrix', name: 'matrix', bg: '#000000', main: '#15ff00', sub: '#006500', subAlt: '#032000', text: '#d1ffcd', error: '#da3333' },
  { id: 'terminal', name: 'terminal', bg: '#191a1b', main: '#79a617', sub: '#48494b', subAlt: '#141516', text: '#e7eae0', error: '#a61717' },
  { id: 'serene', name: 'serene', bg: '#111111', main: '#ffcf5a', sub: '#5b5b5b', subAlt: '#1a1a1a', text: '#dfdfdf', error: '#d44c4c' },
  { id: 'cyberpunk', name: 'cyberpunk', bg: '#0b0b19', main: '#f9f002', sub: '#4b4b7a', subAlt: '#13132a', text: '#00f0ff', error: '#ff003c' },
  { id: 'coffee', name: 'coffee', bg: '#2b1d16', main: '#c69c6d', sub: '#6e5243', subAlt: '#34241b', text: '#efe0cf', error: '#e05a47' },
  { id: 'sakura', name: 'sakura', bg: '#fbe8ee', main: '#d1557a', sub: '#c8a3af', subAlt: '#f6dbe3', text: '#5a3a46', error: '#b5172e' },
  { id: 'mint', name: 'mint', bg: '#e8f5ef', main: '#2a9d74', sub: '#8fb5a5', subAlt: '#d9eee4', text: '#1f3a2f', error: '#d64045' },
  { id: 'arctic', name: 'arctic', bg: '#f5f9fc', main: '#2f7bbf', sub: '#9aaebe', subAlt: '#e7eff6', text: '#1c2b38', error: '#d1343e' },
  { id: 'iceberg-dark', name: 'iceberg dark', bg: '#161821', main: '#84a0c6', sub: '#595e76', subAlt: '#0f1117', text: '#c6c8d1', error: '#e27878' },
  { id: 'iceberg-light', name: 'iceberg light', bg: '#e8e9ec', main: '#2d539e', sub: '#adb1c4', subAlt: '#ccceda', text: '#33374c', error: '#cc517a' },
  { id: 'olivia', name: 'olivia', bg: '#1c1b1d', main: '#deaf9d', sub: '#4e3b42', subAlt: '#232123', text: '#f2efed', error: '#bf616a' },
  { id: 'red-dragon', name: 'red dragon', bg: '#1a0b0c', main: '#ff3a32', sub: '#e2a528', subAlt: '#240e0f', text: '#4a4d4e', error: '#771b1f' },
  { id: 'night-runner', name: 'night runner', bg: '#212121', main: '#feff04', sub: '#5c4a9c', subAlt: '#1a1a1a', text: '#e8e8e8', error: '#da3333' },
  { id: 'bliss', name: 'bliss', bg: '#262727', main: '#f0d3c9', sub: '#665957', subAlt: '#343231', text: '#fff2ee', error: '#bd4141' },
  { id: 'dots', name: 'dots', bg: '#121520', main: '#fff', sub: '#676e8a', subAlt: '#1b1f2e', text: '#fff', error: '#da3333' },
];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export const themeById = (id: string | null | undefined): Theme => BY_ID.get(id ?? '') ?? BY_ID.get(DEFAULT_THEME)!;

// ---- colour maths (hex in, hex/rgba out) so Chart.js can read the tokens too

const parse = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: number[]): string => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** `a` blended toward `b` by `amount` (0 = a, 1 = b). */
export const mix = (a: string, b: string, amount: number): string => {
  const [x, y] = [parse(a), parse(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * amount));
};

export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Relative luminance (WCAG), 0 = black, 1 = white. */
export const luminance = (hex: string): number => {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Black or white, whichever reads better on `hex`. */
const readableOn = (hex: string): string => (luminance(hex) > 0.4 ? '#111111' : '#ffffff');

/** Every design token for a theme. */
export const themeTokens = (t: Theme): Record<string, string> => {
  const light = luminance(t.bg) > 0.4;
  return {
    'color-bg': t.bg,
    'color-surface': t.subAlt,
    'color-surface-solid': t.subAlt,
    'color-surface-raised': mix(t.subAlt, t.text, 0.08),
    'color-card': t.subAlt,
    'color-typing-box': t.subAlt,
    'color-header': t.bg,
    'color-input': mix(t.subAlt, t.bg, 0.5),
    'color-key': t.subAlt,
    'color-track': mix(t.subAlt, t.sub, 0.25),
    'color-border': mix(t.subAlt, t.sub, 0.25),
    'color-border-strong': mix(t.subAlt, t.sub, 0.6),
    'color-border-subtle': rgba(t.text, 0.07),
    'color-text': t.text,
    'color-text-muted': mix(t.text, t.sub, 0.35),
    'color-text-subtle': t.sub,
    'color-text-faint': mix(t.sub, t.bg, light ? 0.3 : 0.4),
    'color-primary': t.main,
    'color-primary-hover': mix(t.main, t.text, 0.15),
    'color-primary-glow': rgba(t.main, 0.35),
    'color-on-primary': readableOn(t.main),
    'color-accent': t.main,
    'color-accent-hover': mix(t.main, t.text, 0.25),
    'color-error': t.error,
    'color-caret': t.main,
    'color-wpm': t.main,
    'color-heat-3': t.error,
  };
};

const TOKEN_NAMES = Object.keys(themeTokens(THEMES[0]));

/**
 * Applies a theme to the page. The default (crimson) uses the hand-tuned
 * values in styles.css, so its tokens are cleared rather than set.
 */
export const applyTheme = (root: HTMLElement, id: string): void => {
  const theme = themeById(id);
  root.dataset['theme'] = theme.id;
  root.dataset['themeTone'] = luminance(theme.bg) > 0.4 ? 'light' : 'dark';
  if (theme.id === DEFAULT_THEME) {
    for (const name of TOKEN_NAMES) root.style.removeProperty(`--${name}`);
    return;
  }
  for (const [name, value] of Object.entries(themeTokens(theme))) root.style.setProperty(`--${name}`, value);
};
