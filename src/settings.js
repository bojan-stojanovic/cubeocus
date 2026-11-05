// Player settings (accessibility etc.), saved in localStorage.
const KEY = 'cubeocus.settings.v1';

const prefersReduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export const settings = {
  reducedMotion: prefersReduced(), // defaults to the OS preference
  colorblind: false,
  large: false,
  haptics: true,
};

try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* ignore */ }

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

// Okabe-Ito colour-blind-safe overrides: blue sliders, orange rotors, purple gates.
export const COLORBLIND_THEME = { block: 0x0072b2, rotor: 0xe69f00, gate: 0xcc79a7 };

export function applySettingsToDom() {
  document.body.classList.toggle('reduced', settings.reducedMotion);
  document.body.classList.toggle('large', settings.large);
}
