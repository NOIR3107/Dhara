import { useEffect, useState } from 'react';

// The DHARA pages define their palette as CSS custom properties and switch
// light/dark by setting data-theme on <html> (then firing
// "dhara-theme-change"). React Bits components take literal colour props, so
// read the resolved values and re-read them whenever the theme changes.
const TOKENS = [
  'ink', 'ink-soft', 'taupe', 'card', 'canvas', 'sand', 'sand-soft', 'sand-strong',
  'line', 'espresso', 'crimson', 'amber', 'green', 'red', 'blue', 'on-espresso'
];

function read() {
  const css = getComputedStyle(document.documentElement);
  const out = { dark: document.documentElement.getAttribute('data-theme') === 'dark' };
  TOKENS.forEach(t => {
    out[t.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = css.getPropertyValue(`--${t}`).trim();
  });
  return out;
}

export function useTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const update = () => setTheme(read());
    window.addEventListener('dhara-theme-change', update);
    // Also catch theme changes made by other code that forgot the event.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      window.removeEventListener('dhara-theme-change', update);
      observer.disconnect();
    };
  }, []);
  return theme;
}

// "H S L" string for BorderGlow's glowColor from a #rrggbb colour.
export function hexToHslTriplet(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  if (!m) return '40 80 80';
  const [r, g, b] = m.slice(1).map(v => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)} ${Math.round(l * 100)}`;
}

export const API_BASE = `http://${window.location.hostname || 'localhost'}:3001`;
