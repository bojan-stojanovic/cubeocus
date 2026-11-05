// Pure game logic (no DOM / three.js) so levels can be verified in Node.
//
// Grid legend:
//   S start   G goal   # fixed tile (height 0)   1-4 fixed tile at that height   . empty
//   a-z (not 'v')  slider block      A-F  rotor block (pivot cell + rotating arm)
//   *  pressure plate (blocks may rest on it)
//   =  gate (walkable only while every plate is covered)
//   > < ^ v  one-way tile (entered and left only along its arrow)
//
// Block state ("position"): slider = cell index along its rail, rotor = arm orientation 0..3.

export const key = (x, z) => x + ',' + z;
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // rotor arm orientations
const ARROWS = { '>': 0, 'v': 1, '<': 2, '^': 3 };

export function parseLevel(def) {
  const rows = def.grid;
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const cells = new Map(); // key -> {x,z,h,kind,dir}
  const plates = [];
  const blocks = [];
  let start = null;
  let goal = null;
  const put = (x, z, h, kind, dir = -1) => cells.set(key(x, z), { x, z, h, kind, dir });

  rows.forEach((row, z) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '#') put(x, z, 0, 'tile');
      else if (c >= '1' && c <= '4') put(x, z, Number(c), 'tile');
      else if (c === 'S') { put(x, z, def.startH || 0, 'tile'); start = { x, z, h: def.startH || 0 }; }
      else if (c === 'G') { put(x, z, def.goalH || 0, 'tile'); goal = { x, z, h: def.goalH || 0 }; }
      else if (c === '*') { put(x, z, 0, 'plate'); plates.push(key(x, z)); }
      else if (c === '=') put(x, z, 0, 'gate');
      else if (c in ARROWS) put(x, z, 0, 'tile', ARROWS[c]);
      else if (/[A-F]/.test(c)) {
        const d = def.blocks[c];
        if (!d) throw new Error('Missing rotor definition: ' + c);
        blocks.push({ id: c, type: 'rotor', x, z, pos: d.arm || 0, h: d.h || 0 });
      } else if (/[a-z]/.test(c)) {
        const d = def.blocks[c];
        if (!d) throw new Error('Missing block definition: ' + c);
        blocks.push({
          id: c,
          type: 'slide',
          axis: d.axis,
          fixed: d.axis === 'x' ? z : x,
          pos: d.axis === 'x' ? x : z,
          min: d.range[0],
          max: d.range[1],
          h: d.h || 0,
        });
      }
    }
  });
  if (!start || !goal) throw new Error('Level needs S and G');
  return { name: def.name, hint: def.hint, W, H, cells, plates, start, goal, blocks };
}

// Cells a block occupies in a given state.
export function blockCells(b, p) {
  if (b.type === 'rotor') {
    const [dx, dz] = DIRS[p];
    return [{ x: b.x, z: b.z, h: b.h }, { x: b.x + dx, z: b.z + dz, h: b.h }];
  }
  return [b.axis === 'x' ? { x: p, z: b.fixed, h: b.h } : { x: b.fixed, z: p, h: b.h }];
}

// Cell map of everything currently covered by blocks (optionally ignoring one block).
function occupancy(level, positions, except = -1) {
  const occ = new Map();
  for (let i = 0; i < level.blocks.length; i++) {
    if (i === except) continue;
    for (const c of blockCells(level.blocks[i], positions[i])) occ.set(key(c.x, c.z), c.h);
  }
  return occ;
}

// Fixed things blocks cannot slide/rotate into (plates are the only floor they may cover).
function solid(level, x, z) {
  const c = level.cells.get(key(x, z));
  return !!c && c.kind !== 'plate';
}

const inBounds = (level, x, z) => x >= 0 && z >= 0 && x < level.W && z < level.H;

// Free cells for block i to occupy (used for sliding and rotating).
function freeCell(level, occ, c) {
  return inBounds(level, c.x, c.z) && !solid(level, c.x, c.z) && !occ.has(key(c.x, c.z));
}

// Reachable range [lo, hi] along a slider's rail from its current position.
export function reach(level, positions, i) {
  const b = level.blocks[i];
  const occ = occupancy(level, positions, i);
  const free = (p) => freeCell(level, occ, blockCells(b, p)[0]);
  let lo = positions[i];
  let hi = positions[i];
  while (lo - 1 >= b.min && free(lo - 1)) lo--;
  while (hi + 1 <= b.max && free(hi + 1)) hi++;
  return [lo, hi];
}

// All states block i can switch to in one move (slider: any reachable cell, rotor: next 90 degrees).
export function moveOptions(level, positions, i) {
  const b = level.blocks[i];
  if (b.type === 'rotor') {
    const occ = occupancy(level, positions, i);
    const next = (positions[i] + 1) % 4;
    return freeCell(level, occ, blockCells(b, next)[1]) ? [next] : [];
  }
  const [lo, hi] = reach(level, positions, i);
  const out = [];
  for (let p = lo; p <= hi; p++) if (p !== positions[i]) out.push(p);
  return out;
}

// Can rotor i turn right now? (UI uses this for the wobble feedback.)
export const canRotate = (level, positions, i) => moveOptions(level, positions, i).length > 0;

// BFS from start to goal. Returns [{x,z,h}] or null.
export function findPath(level, positions) {
  const occ = occupancy(level, positions);
  const gatesOpen = level.plates.every((k) => occ.has(k));
  const info = (x, z) => {
    const k = key(x, z);
    if (occ.has(k)) return { h: occ.get(k), dir: -1 };
    const c = level.cells.get(k);
    if (!c) return null;
    if (c.kind === 'gate') return gatesOpen ? { h: c.h, dir: -1 } : null;
    return { h: c.h, dir: c.dir };
  };
  const { start, goal } = level;
  const sk = key(start.x, start.z);
  const prev = new Map([[sk, null]]);
  const queue = [{ x: start.x, z: start.z, h: start.h, dir: level.cells.get(sk).dir }];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (cur.x === goal.x && cur.z === goal.z) {
      const path = [];
      let k = key(cur.x, cur.z);
      while (k) {
        const [x, z] = k.split(',').map(Number);
        path.unshift({ x, z, h: prev.get(k) ? prev.get(k).h : start.h });
        k = prev.get(k) && prev.get(k).from;
      }
      return path;
    }
    for (let d = 0; d < 4; d++) {
      const x = cur.x + DIRS[d][0];
      const z = cur.z + DIRS[d][1];
      const k = key(x, z);
      if (prev.has(k)) continue;
      const n = info(x, z);
      if (!n || Math.abs(n.h - cur.h) > 1) continue;
      if (cur.dir >= 0 && cur.dir !== d) continue; // leaving a one-way tile
      if (n.dir >= 0 && n.dir !== d) continue; // entering a one-way tile
      prev.set(k, { from: key(cur.x, cur.z), h: n.h });
      queue.push({ x, z, h: n.h, dir: n.dir });
    }
  }
  return null;
}

// Shortest list of moves [{i, to}] from `positions` that connects start to goal.
// Returns [] if already connected, null if unsolvable, 'capped' if the search got too big.
export function solveFrom(level, positions, maxStates = Infinity) {
  const startKey = positions.join();
  const parent = new Map([[startKey, null]]);
  let frontier = [positions.slice()];
  while (frontier.length) {
    if (parent.size > maxStates) return 'capped';
    const next = [];
    for (const s of frontier) {
      if (findPath(level, s)) {
        const moves = [];
        let k = s.join();
        while (parent.get(k)) {
          const p = parent.get(k);
          moves.unshift(p.move);
          k = p.from;
        }
        return moves;
      }
      for (let i = 0; i < s.length; i++) {
        for (const p of moveOptions(level, s, i)) {
          const n = s.slice();
          n[i] = p;
          const k = n.join();
          if (parent.has(k)) continue;
          parent.set(k, { from: s.join(), move: { i, to: p } });
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return null;
}

// Minimum number of moves from the initial state (-1 unsolvable, -2 too big to analyse).
export function solve(level, maxStates = Infinity) {
  const r = solveFrom(level, level.blocks.map((b) => b.pos), maxStates);
  if (r === 'capped') return -2;
  return r ? r.length : r === null ? -1 : 0;
}

// Copy of the level with block i removed (used to detect blocks that do nothing).
export function withoutBlock(level, i) {
  return { ...level, blocks: level.blocks.filter((_, k) => k !== i) };
}

// Indices of blocks that do nothing: the level needs exactly as many moves without them.
// (A block whose removal makes the level easier is an obstacle and counts as useful.)
export function uselessBlocks(level, maxStates = 400000) {
  const par = solve(level, maxStates);
  if (par < 0) return [];
  const out = [];
  for (let i = 0; i < level.blocks.length; i++) {
    const p = solve(withoutBlock(level, i), maxStates);
    if (p === par) out.push(i);
  }
  return out;
}
