// DOM overlays + saved progress.
import { PACKS } from './levels.js';
import { THEMES } from './themes.js';

const $ = (id) => document.getElementById(id);
const STORE = 'hocus.progress.v2';
const OLD_STORE = 'hocus.progress.v1';

export function loadProgress() {
  for (const k of [STORE, OLD_STORE]) { // v1 progress carries over (same level order for the first 18)
    try {
      const p = JSON.parse(localStorage.getItem(k));
      if (p && typeof p.unlocked === 'number') return { unlocked: p.unlocked, stars: p.stars || {} };
    } catch { /* ignore */ }
  }
  return { unlocked: 0, stars: {} };
}

export function saveProgress(p) {
  try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* ignore */ }
}

export function initUI(h) {
  $('btn-restart').onclick = h.onRestart;
  $('btn-menu').onclick = h.onMenu;
  $('btn-replay').onclick = h.onRestart;
  $('btn-next').onclick = h.onNext;
  $('btn-undo').onclick = h.onUndo;
  $('btn-hint').onclick = h.onHint;
  $('btn-music').onclick = h.onMusic;
  $('btn-sfx').onclick = h.onSfx;
  $('btn-play').onclick = h.onPlay;
  $('btn-title-levels').onclick = h.onMenu;
  $('btn-title-daily').onclick = h.onDaily;
  $('btn-daily').onclick = h.onDaily;
  $('btn-settings').onclick = h.onSettings;
  $('btn-title-settings').onclick = h.onSettings;
  $('btn-close-settings').onclick = () => $('settings').classList.add('hidden');
  $('btn-close-levels').onclick = () => $('levels').classList.add('hidden');
}

export function setHud(title, moves, par) {
  $('title').textContent = title;
  $('moves').textContent = `Moves ${moves}` + (par ? ` · Par ${par}` : '');
}

export function setHint(text) {
  const el = $('hint');
  el.textContent = text || '';
  el.classList.toggle('show', !!text);
}

export function setToolbar({ canUndo, canHint, music, sfx }) {
  $('btn-undo').disabled = !canUndo;
  $('btn-hint').disabled = !canHint;
  $('btn-music').classList.toggle('off', !music);
  $('btn-sfx').classList.toggle('off', !sfx);
  $('btn-sfx').firstChild.textContent = sfx ? '🔊' : '🔇';
}

export function showTitle(show, hasProgress) {
  $('titlescreen').classList.toggle('hidden', !show);
  $('btn-play').textContent = hasProgress ? 'Continue' : 'Play';
}

export function showBusy(show, text) {
  if (text) $('busy-text').textContent = text;
  $('busy').classList.toggle('hidden', !show);
}

export function showWin({ moves, par, stars, hinted, next }) {
  $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('win-text').textContent = `${moves} move${moves === 1 ? '' : 's'} (par ${par})` + (hinted ? ' · hint used' : '');
  $('win-title').textContent = next === 'done' ? 'All levels solved!' : 'Solved!';
  $('btn-next').textContent = next === 'menu' ? 'Menu' : next === 'done' ? 'Level select' : 'Next ›';
  $('overlay').classList.remove('hidden');
}

export function hideWin() {
  $('overlay').classList.add('hidden');
}

// levels: flat list; each has .pack (index into PACKS)
export function showLevels(levels, progress, current, onPick) {
  const list = $('level-list');
  list.innerHTML = '';
  PACKS.forEach((pack, pi) => {
    const head = document.createElement('div');
    head.className = 'pack';
    const dot = document.createElement('i');
    dot.style.background = THEMES[pack.theme].css.bg2;
    head.append(dot, document.createTextNode(pack.name));
    const grid = document.createElement('div');
    grid.className = 'level-grid';
    levels.forEach((l, i) => {
      if (l.pack !== pi) return;
      const b = document.createElement('button');
      const s = progress.stars[i] || 0;
      b.className = 'lvl' + (i === current ? ' current' : '');
      b.disabled = i > progress.unlocked;
      b.innerHTML = `<span class="n">${i + 1}</span><span class="s">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`;
      b.title = l.name;
      b.onclick = () => { $('levels').classList.add('hidden'); onPick(i); };
      grid.appendChild(b);
    });
    list.append(head, grid);
  });
  $('levels').classList.remove('hidden');
}

// ---- settings panel ------------------------------------------------------------------
const OPTS = { 'opt-reduced': 'reducedMotion', 'opt-cb': 'colorblind', 'opt-large': 'large', 'opt-haptics': 'haptics' };

export function initSettingsPanel(settings, onChange) {
  for (const [id, key] of Object.entries(OPTS)) {
    $(id).checked = !!settings[key];
    $(id).onchange = () => { settings[key] = $(id).checked; onChange(key); };
  }
}

export function showSettings() {
  $('settings').classList.remove('hidden');
  $('opt-reduced').focus();
}

// Escape closes whichever dialog is open (levels / settings / win panel stays).
export function closeDialogs() {
  let closed = false;
  for (const id of ['settings', 'levels']) {
    if (!$(id).classList.contains('hidden')) { $(id).classList.add('hidden'); closed = true; }
  }
  return closed;
}
