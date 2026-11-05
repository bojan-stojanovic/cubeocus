// Seeded random level generator (pure: used by tools/gen.mjs and the in-game Daily puzzle).
import { parseLevel, solve, uselessBlocks } from './logic.js';

export function makeRng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const k = (x, z) => x + ',' + z;
const SLIDER_IDS = 'abcdefghijklmnop';
const ROTOR_IDS = 'ABCDEF';
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// opts: { rotors: n, plates: bool }
export function generateLevel(rnd, opts = {}) {
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const W = ri(7, 9), H = ri(5, 7);

  // self-avoiding walk from the left edge to the right edge
  const S = { x: 0, z: ri(0, H - 1) };
  const path = [S];
  const used = new Set([k(S.x, S.z)]);
  let cur = S;
  for (let n = 0; n < 60 && cur.x < W - 1; n++) {
    const opt = [[1, 0], [1, 0], [0, 1], [0, -1]]
      .map(([dx, dz]) => ({ x: cur.x + dx, z: cur.z + dz }))
      .filter((c) => c.x >= 0 && c.x < W && c.z >= 0 && c.z < H && !used.has(k(c.x, c.z)));
    if (!opt.length) return null;
    cur = opt[ri(0, opt.length - 1)];
    used.add(k(cur.x, cur.z));
    path.push(cur);
  }
  if (cur.x !== W - 1 || path.length < 9) return null;
  const G = path[path.length - 1];

  // choose non-adjacent gap indices on the path
  const gaps = [];
  const nGaps = ri(3, 5);
  for (let t = 0; t < 40 && gaps.length < nGaps; t++) {
    const i = ri(1, path.length - 2);
    if (gaps.some((g) => Math.abs(g - i) < 2)) continue;
    gaps.push(i);
  }
  if (gaps.length < 3) return null;

  const statics = new Set(path.map((c) => k(c.x, c.z)));
  const occ = new Set(); // initial cells covered by blocks
  const sliders = []; // {axis, fixed, pos, min, max, bridge}
  const rotors = []; // {x, z, arm}
  let gate = null;
  let plate = null;

  const sliderCell = (b, p) => (b.axis === 'x' ? k(p, b.fixed) : k(b.fixed, p));
  const addSlider = (axis, fixed, lo, hi, startP, bridge = false) => {
    const b = { axis, fixed, pos: startP, min: lo, max: hi, bridge };
    const ck = sliderCell(b, startP);
    if (statics.has(ck) || occ.has(ck) || (plate && ck === plate)) return null;
    occ.add(ck);
    sliders.push(b);
    return b;
  };
  const lim = (axis) => (axis === 'x' ? W : H);
  const rail = (axis) => [ri(0, 2), lim(axis) - 1 - ri(0, 2)];

  // decide which gaps become rotors / plate-gate / slider bridges
  const gapCells = gaps.map((i) => path[i]);
  let rotorsLeft = opts.rotors || 0;
  let gateDone = !opts.plates;
  const bridges = []; // slider bridges with their gap cell, for coupled blockers

  for (const g of gapCells) {
    statics.delete(k(g.x, g.z));
  }
  for (const g of gapCells) {
    let ok = false;
    if (!gateDone && rnd() < 0.5) {
      // this cell becomes a gate; a slider must rest on a plate somewhere off the path
      for (let t = 0; t < 20 && !ok; t++) {
        const px = ri(0, W - 1), pz = ri(0, H - 1);
        const pk = k(px, pz);
        if (statics.has(pk) || occ.has(pk) || (g.x === px && g.z === pz)) continue;
        if (gapCells.some((c) => c.x === px && c.z === pz)) continue;
        const axis = rnd() < 0.5 ? 'x' : 'z';
        const fixed = axis === 'x' ? pz : px;
        const along = axis === 'x' ? px : pz;
        const [rl, rh] = rail(axis);
        const lo = Math.min(rl, along), hi = Math.max(rh, along);
        const startP = ri(lo, hi);
        if (startP === along) continue;
        plate = pk;
        const b = addSlider(axis, fixed, lo, hi, startP, false);
        if (!b) { plate = null; continue; }
        gate = g;
        gateDone = true;
        ok = true;
      }
    } else if (rotorsLeft > 0 && rnd() < 0.6) {
      for (let t = 0; t < 12 && !ok; t++) {
        const d = ri(0, 3);
        const px = g.x - DIRS[d][0], pz = g.z - DIRS[d][1]; // pivot sits next to the gap
        const pk = k(px, pz);
        if (px < 0 || pz < 0 || px >= W || pz >= H || statics.has(pk) || occ.has(pk)) continue;
        if (gapCells.some((c) => c.x === px && c.z === pz)) continue;
        const arm = (d + ri(1, 3)) % 4;
        const ax = px + DIRS[arm][0], az = pz + DIRS[arm][1];
        const ak = k(ax, az);
        if (ax < 0 || az < 0 || ax >= W || az >= H || statics.has(ak) || occ.has(ak)) continue;
        if (gapCells.some((c) => k(c.x, c.z) === ak)) continue;
        occ.add(pk); occ.add(ak);
        rotors.push({ x: px, z: pz, arm });
        rotorsLeft--;
        ok = true;
      }
    }
    if (!ok) {
      for (let t = 0; t < 12 && !ok; t++) {
        const axis = rnd() < 0.5 ? 'x' : 'z';
        const fixed = axis === 'x' ? g.z : g.x;
        const along = axis === 'x' ? g.x : g.z;
        const [rl, rh] = rail(axis);
        const lo = Math.min(rl, along), hi = Math.max(rh, along);
        const startP = ri(lo, hi);
        if (startP === along) continue;
        const b = addSlider(axis, fixed, lo, hi, startP, true);
        if (b) { bridges.push({ b, g }); ok = true; }
      }
    }
    if (!ok) return null;
  }
  if (!gateDone) return null;

  // coupled blockers: sit on a bridge slider's rail between its start and its gap
  const extra = ri(1, 3);
  for (let n = 0; n < extra && bridges.length; n++) {
    for (let t = 0; t < 12; t++) {
      const { b: br, g } = bridges[ri(0, bridges.length - 1)];
      const gp = br.axis === 'x' ? g.x : g.z;
      const lo = Math.min(br.pos, gp), hi = Math.max(br.pos, gp);
      if (hi - lo < 1) continue;
      const p = ri(lo, hi);
      if (p === br.pos) continue;
      const axis = br.axis === 'x' ? 'z' : 'x';
      const along = br.fixed;
      const rl = Math.max(0, along - ri(1, 3)), rh = Math.min(lim(axis) - 1, along + ri(1, 3));
      if (addSlider(axis, p, rl, rh, along, false)) break;
    }
  }
  if (sliders.length > 7 || sliders.length + rotors.length > 8) return null;

  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  for (const c of statics) { const [x, z] = c.split(',').map(Number); grid[z][x] = '#'; }
  if (gate) grid[gate.z][gate.x] = '=';
  if (plate) { const [x, z] = plate.split(',').map(Number); grid[z][x] = '*'; }
  grid[S.z][S.x] = 'S';
  grid[G.z][G.x] = 'G';
  const defs = {};
  sliders.forEach((b, i) => {
    const id = SLIDER_IDS[i];
    const x = b.axis === 'x' ? b.pos : b.fixed;
    const z = b.axis === 'x' ? b.fixed : b.pos;
    grid[z][x] = id;
    defs[id] = { axis: b.axis, range: [b.min, b.max] };
  });
  rotors.forEach((r, i) => {
    const id = ROTOR_IDS[i];
    grid[r.z][r.x] = id;
    defs[id] = { type: 'rotor', arm: r.arm };
  });
  return { grid: grid.map((r) => r.join('')), blocks: defs };
}

// Search for levels needing at least `minPar` moves where every block matters.
// onFound(def, par) is called per hit; stops after `want` hits or `tries` attempts.
export function searchLevels({ seed = 1, tries = 20000, minPar = 6, want = Infinity, opts = {}, maxStates = 150000, onFound }) {
  const rnd = makeRng(seed);
  const seen = new Set();
  const found = [];
  for (let t = 0; t < tries && found.length < want; t++) {
    const def = generateLevel(rnd, opts);
    if (!def) continue;
    const id = def.grid.join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    let lvl, par;
    try { lvl = parseLevel({ ...def, name: 'x' }); par = solve(lvl, maxStates); } catch { continue; }
    if (par < minPar) continue;
    if (uselessBlocks(lvl, maxStates).length) continue;
    found.push({ def, par });
    if (onFound) onFound(def, par);
  }
  return found;
}
