import './style.css';
import * as THREE from 'three';
import { LEVELS, PACKS } from './levels.js';
import { parseLevel, reach, findPath, solve, solveFrom, canRotate, moveOptions } from './logic.js';
import { Board, STEP_H } from './board.js';
import { Cube } from './cube.js';
import { THEMES, applyCss } from './themes.js';
import { sfx } from './audio.js';
import { settings, saveSettings, applySettingsToDom, COLORBLIND_THEME } from './settings.js';
import {
  initUI, setHud, setHint, setToolbar, showTitle, showBusy, showWin, hideWin, showLevels, loadProgress, saveProgress,
  initSettingsPanel, showSettings, closeDialogs,
} from './ui.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
const CAM = new THREE.Vector3(20, 20, 20);
camera.position.copy(CAM);
camera.lookAt(0, -0.2, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0xf0c4b8, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(6, 14, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.radius = 4;
scene.add(sun);

// soft shadow that makes the board look like it floats
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.12 }));
floor.position.y = -1.6;
floor.receiveShadow = true;
scene.add(floor);

const board = new Board(scene);
const cube = new Cube(scene);

const game = {
  index: 0, def: null, level: null, positions: [], history: [], moves: 0, par: 0, hints: 0,
  busy: false, won: false, run: 0, drag: null, sel: -1, theme: null, tapTipShown: false, progress: loadProgress(), intro: true, hintTimer: null,
};

const buzz = (ms) => {
  try {
    if (settings.haptics && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms);
  } catch { /* ignore */ }
};

function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  const a = w / h;
  const n = game.level ? game.level.W + game.level.H : 8;
  const lift = board.maxH * STEP_H * 1.2;
  const vw = n * 0.7071 + 2.4;
  const vh = n * 0.41 + 4.2 + lift;
  const H = Math.max(vh, vw / a);
  camera.top = H / 2;
  camera.bottom = -H / 2;
  camera.left = (-H * a) / 2;
  camera.right = (H * a) / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', fit);

function refreshToolbar() {
  const s = sfx.state;
  setToolbar({ canUndo: game.history.length > 0 && !game.busy, canHint: !game.busy && !game.intro, music: s.music, sfx: s.sfx });
}

function updateHud() {
  setHud(game.index >= 0 ? `${game.index + 1}. ${game.level.name}` : game.level.name, game.moves, game.par > 0 ? game.par : 0);
}

const effectiveTheme = (theme) => (settings.colorblind ? { ...theme, ...COLORBLIND_THEME } : theme);

// target: level index, or a level definition object (daily puzzle)
function loadLevel(target) {
  clearTimeout(game.hintTimer);
  game.run++;
  const isIndex = typeof target === 'number';
  const def = isIndex ? LEVELS[target] : target;
  game.index = isIndex ? target : -1;
  game.def = def;
  game.level = parseLevel(def);
  game.positions = game.level.blocks.map((b) => b.pos);
  game.history = [];
  game.moves = 0;
  game.hints = 0;
  game.busy = false;
  game.won = false;
  game.drag = null;
  game.sel = -1;
  board.reduced = cube.reduced = settings.reducedMotion;
  const par = solve(game.level, 800000);
  game.par = par > 0 ? par : 0;

  const theme = THEMES[isIndex ? PACKS[def.pack].theme : def.theme];
  applyCss(theme);
  hemi.color.setHex(theme.sky);
  hemi.groundColor.setHex(theme.ground);
  game.theme = theme;
  board.load(game.level, effectiveTheme(theme));
  const s = game.level.start;
  cube.place(board.world(s.x, s.z, s.h), settings.reducedMotion ? 0 : 0.7);
  hideWin();
  updateHud();
  setHint(def.hint);
  refreshToolbar();
  fit();
}

// ---- tap-to-move selection ---------------------------------------------------------------
function clearSelection() {
  game.sel = -1;
  board.select(-1);
}

function selectBlock(i) {
  const options = moveOptions(game.level, game.positions, i);
  if (!options.length) { board.shake(i); sfx.fail(); buzz(30); return; }
  game.sel = i;
  board.select(i, options);
  if (!game.tapTipShown) {
    game.tapTipShown = true;
    setHint('Tap a highlighted cell to move the block');
    game.hintTimer = setTimeout(() => setHint(''), 3000);
  }
}

// ---- moves ---------------------------------------------------------------------------
function commit(i, to) {
  clearSelection();
  game.history.push({ positions: game.positions.slice(), moves: game.moves });
  game.positions[i] = to;
  game.moves++;
  board.setBlockState(i, to);
  const gate = board.updateSupport(game.positions);
  if (gate !== null) sfx.gate(gate);
  if (game.level.blocks[i].type === 'rotor') sfx.rotate(); else sfx.snap();
  buzz(12);
  clearHintUi();
  updateHud();
  refreshToolbar();
  const path = findPath(game.level, game.positions);
  if (path) solved(path);
}

function undo() {
  if (game.busy || !game.history.length) return;
  clearSelection();
  const h = game.history.pop();
  game.positions = h.positions.slice();
  game.moves = h.moves;
  game.positions.forEach((p, i) => board.setBlockState(i, p));
  board.updateSupport(game.positions);
  board.highlightPath(null);
  clearHintUi();
  sfx.undo();
  updateHud();
  refreshToolbar();
}

function clearHintUi() {
  clearTimeout(game.hintTimer);
  board.clearHint();
  setHint('');
}

function hint() {
  if (game.busy || game.intro) return;
  clearSelection();
  const sol = solveFrom(game.level, game.positions, 500000);
  clearHintUi();
  if (sol === null || sol === 'capped') {
    setHint(sol === null ? 'No solution from here. Try undo or restart.' : 'Too complex to hint.');
    game.hintTimer = setTimeout(() => setHint(''), 3000);
    return;
  }
  if (!sol.length) return;
  game.hints++;
  board.showHint(sol[0], game.positions);
  sfx.hint();
  setHint(sol.length === 1 ? 'One move left' : `${sol.length} moves left`);
  game.hintTimer = setTimeout(clearHintUi, 3500);
}

async function solved(path) {
  const run = game.run;
  game.busy = true;
  refreshToolbar();
  await new Promise((r) => setTimeout(r, 250)); // let the block settle
  await cube.run(path.map((c) => board.world(c.x, c.z, c.h)));
  if (run !== game.run) return; // level was changed while the cube was rolling
  let stars = game.moves <= game.par ? 3 : game.moves <= game.par + 1 ? 2 : 1;
  if (game.hints) stars = Math.min(stars, 2);
  const daily = game.index < 0;
  if (!daily) {
    const p = game.progress;
    p.stars[game.index] = Math.max(p.stars[game.index] || 0, stars);
    p.unlocked = Math.max(p.unlocked, Math.min(game.index + 1, LEVELS.length - 1));
    saveProgress(p);
  }
  buzz(60);
  game.won = true;
  showWin({
    moves: game.moves, par: game.par, stars, hinted: game.hints > 0,
    next: daily ? 'menu' : game.index === LEVELS.length - 1 ? 'done' : 'next',
  });
}

// ---- pointer input -----------------------------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}

function axisCoord(axis, h) {
  groundPlane.constant = -h * STEP_H;
  if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
  return axis === 'x' ? hit.x + board.ox : hit.z + board.oz;
}

// Block under the pointer: exact hit first, then the nearest block within a finger-sized radius (touch assist).
function pickBlock(e) {
  setNdc(e);
  const hits = ray.intersectObjects(board.pickables, false);
  if (hits.length) return hits[0].object.userData.index;
  const rect = canvas.getBoundingClientRect();
  const radius = settings.large ? 46 : 26;
  const v = new THREE.Vector3();
  let best = -1;
  let bestD = radius;
  for (let i = 0; i < game.level.blocks.length; i++) {
    for (const a of board.blockAnchors(i, game.positions[i])) {
      v.copy(a).project(camera);
      const px = (v.x * 0.5 + 0.5) * rect.width + rect.left;
      const py = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
      const d = Math.hypot(px - e.clientX, py - e.clientY);
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best;
}

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (game.busy || game.intro) return;
  setNdc(e);
  if (game.sel >= 0) { // tap-to-move: did the tap land on a highlighted target cell?
    const t = ray.intersectObjects(board.targetMeshes, false);
    if (t.length) {
      const i = game.sel;
      commit(i, t[0].object.userData.to);
      return;
    }
  }
  const i = pickBlock(e);
  if (i < 0) { clearSelection(); return; }
  const b = game.level.blocks[i];
  canvas.setPointerCapture(e.pointerId);
  sfx.pick();
  clearHintUi();
  if (b.type === 'rotor') {
    clearSelection();
    game.drag = { i, rotor: true, x: e.clientX, y: e.clientY, moved: false };
    return;
  }
  const grab = axisCoord(b.axis, b.h);
  if (grab === null) return;
  const range = reach(game.level, game.positions, i);
  game.drag = { i, grab, start: game.positions[i], range, p: game.positions[i], cand: game.positions[i], x: e.clientX, y: e.clientY, moved: false };
});

canvas.addEventListener('pointermove', (e) => {
  const d = game.drag;
  if (!d) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
    if (!d.moved) clearSelection(); // dragging replaces tap selection
    d.moved = true;
  }
  if (d.rotor) return;
  setNdc(e);
  const b = game.level.blocks[d.i];
  const c = axisCoord(b.axis, b.h);
  if (c === null) return;
  d.p = Math.min(Math.max(d.start + (c - d.grab), d.range[0]), d.range[1]);
  board.setDrag(d.i, d.p);
  const cand = Math.round(d.p);
  if (cand !== d.cand) {
    d.cand = cand;
    // preview: glow the route if releasing here would connect start and goal
    const tmp = game.positions.slice();
    tmp[d.i] = cand;
    board.highlightPath(findPath(game.level, tmp), tmp);
  }
});

function endDrag() {
  const d = game.drag;
  if (!d) return;
  game.drag = null;
  board.highlightPath(null);
  const i = d.i;
  if (d.rotor) {
    if (d.moved) return; // a drag on a rotor does nothing; only a tap turns it
    if (canRotate(game.level, game.positions, i)) commit(i, (game.positions[i] + 1) % 4);
    else { board.shake(i); sfx.fail(); buzz(30); }
    return;
  }
  const snapped = Math.round(d.p);
  if (snapped !== d.start) {
    commit(i, snapped);
    return;
  }
  board.release(i, d.start);
  if (!d.moved) { // a tap: select the block (or deselect it) and show where it can go
    if (game.sel === i) clearSelection(); else selectBlock(i);
  } else if (d.range[0] === d.range[1]) {
    board.shake(i); sfx.fail(); buzz(30);
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---- screens ------------------------------------------------------------------------------
function setIntro(on) {
  game.intro = on;
  document.body.classList.toggle('intro', on);
  showTitle(on, game.progress.unlocked > 0 || Object.keys(game.progress.stars).length > 0);
  refreshToolbar();
}

const openLevels = () => showLevels(LEVELS, game.progress, game.index, (i) => { setIntro(false); loadLevel(i); });

// Daily puzzle: seeded by the date, built in a worker, cached per day
async function playDaily() {
  const now = new Date();
  const id = now.toISOString().slice(0, 10);
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  document.getElementById('levels').classList.add('hidden');
  let def = null;
  try { def = JSON.parse(localStorage.getItem('hocus.daily.' + id)); } catch { /* ignore */ }
  if (!def) {
    showBusy(true, "Building today's puzzle…");
    def = await new Promise((resolve) => {
      const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { w.terminate(); resolve(null); }, 90000);
      w.onmessage = (ev) => { clearTimeout(timer); w.terminate(); resolve(ev.data && ev.data.def); };
      w.onerror = () => { clearTimeout(timer); resolve(null); };
      w.postMessage({ seed, minPar: 6, opts: { rotors: seed % 3, plates: seed % 2 === 0 } });
    });
    showBusy(false);
    if (!def) { setHint('Could not build a daily puzzle. Try again.'); return; }
    try { localStorage.setItem('hocus.daily.' + id, JSON.stringify(def)); } catch { /* ignore */ }
  }
  setIntro(false);
  const themes = Object.keys(THEMES);
  loadLevel({ ...def, name: 'Daily ' + id, theme: themes[seed % themes.length] });
}

initUI({
  onRestart: () => loadLevel(game.index >= 0 ? game.index : game.def),
  onMenu: openLevels,
  onUndo: undo,
  onHint: hint,
  onMusic: () => { sfx.unlock(); sfx.setMusic(!sfx.state.music); refreshToolbar(); },
  onSfx: () => { sfx.unlock(); sfx.setSfx(!sfx.state.sfx); refreshToolbar(); },
  onPlay: () => { sfx.unlock(); setIntro(false); },
  onDaily: playDaily,
  onSettings: showSettings,
  onNext: () => {
    if (game.index < 0) { hideWin(); openLevels(); return; }
    if (game.index >= LEVELS.length - 1) { hideWin(); openLevels(); return; }
    loadLevel(game.index + 1);
  },
});

function onSettingChange(key) {
  saveSettings();
  applySettingsToDom();
  board.reduced = cube.reduced = settings.reducedMotion;
  if (key === 'colorblind' && game.theme) board.setTheme(effectiveTheme(game.theme));
}
initSettingsPanel(settings, onSettingChange);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!closeDialogs()) clearSelection(); return; }
  if (game.intro) return;
  const k = e.key.toLowerCase();
  if ((k === 'z' && (e.ctrlKey || e.metaKey)) || k === 'u') { e.preventDefault(); undo(); }
  else if (k === 'r' && !e.ctrlKey && !e.metaKey) loadLevel(game.index >= 0 ? game.index : game.def);
  else if (k === 'h') hint();
});

// ---- loop -----------------------------------------------------------------------------------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (settings.reducedMotion) camera.position.copy(CAM);
  else camera.position.set(CAM.x + Math.sin(t * 0.25) * 0.7, CAM.y, CAM.z + Math.cos(t * 0.21) * 0.7); // slow idle sway
  camera.lookAt(0, -0.2, 0);
  board.update(dt);
  cube.update(dt);
  renderer.render(scene, camera);
});

// Dev/test helpers: window.hocus.testAll() solves every level through the real commit() path.
window.hocus = {
  game, loadLevel, commit, undo, hint, LEVELS,
  async testAll(from = 0, to = LEVELS.length) {
    const saved = JSON.stringify(game.progress);
    const results = [];
    for (let i = from; i < to; i++) {
      loadLevel(i);
      const sol = solveFrom(game.level, game.positions);
      if (!Array.isArray(sol)) { results.push({ level: i + 1, ok: false, why: String(sol) }); continue; }
      for (const m of sol) commit(m.i, m.to);
      // connectivity is what triggers the win; skip the animation so this also works in a hidden tab
      results.push({ level: i + 1, ok: !!findPath(game.level, game.positions) && game.busy, moves: game.moves, par: game.par });
    }
    game.progress = JSON.parse(saved);
    saveProgress(game.progress);
    return results;
  },
};

// Loading screen (inline in index.html): wait for the first rendered frame and a short minimum so it doesn't flash.
const TIPS = ['Drag blue blocks along their rails', 'Tap blocks with the turn symbol', 'Park a block on a plate to open gates', 'Stuck? Use the hint button', 'A new Daily puzzle every day'];
const tip = document.getElementById('loader-tip');
if (tip) tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

function hideLoader() {
  const el = document.getElementById('loader');
  if (!el) return;
  const wait = Math.max(0, 900 - performance.now());
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
    el.classList.add('done');
    setTimeout(() => el.remove(), 700);
  }, wait)));
}

applySettingsToDom();
loadLevel(Math.min(game.progress.unlocked, LEVELS.length - 1));
setIntro(true);
hideLoader();
