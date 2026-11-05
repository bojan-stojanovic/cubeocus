// Legend: S = start tile, G = goal slot, # = fixed tile, . = empty,
// a-z = movable block (see `blocks`: axis it slides on and its [min,max] rail range).

const ALL = [
  {
    name: 'First Bridge',
    hint: 'Drag the block to bridge the gap',
    grid: ['S#.#G', '..a..'],
    blocks: { a: { axis: 'z', range: [0, 1] } },
  },
  {
    name: 'Two Gaps',
    grid: ['S#.#.#G', '..a.b..'],
    blocks: { a: { axis: 'z', range: [0, 1] }, b: { axis: 'z', range: [0, 1] } },
  },
  {
    name: 'In The Way',
    hint: 'Blocks can block each other',
    grid: ['S#.#G', '..c..', '..a..'],
    blocks: { c: { axis: 'x', range: [0, 4] }, a: { axis: 'z', range: [0, 2] } },
  },
  {
    name: 'Around The Corner',
    grid: ['S#.##', '..a.#', '..b..', '....#', '....G'],
    blocks: { a: { axis: 'z', range: [0, 1] }, b: { axis: 'x', range: [2, 4] } },
  },
  {
    name: 'Right Order',
    grid: ['S#.##', '....#', 'b.a..', '....#', '....G'],
    blocks: { a: { axis: 'z', range: [0, 3] }, b: { axis: 'x', range: [0, 4] } },
  },
  {
    name: 'Four Moves',
    grid: ['S#.#.#G', '..c.d..', '..a.b..'],
    blocks: {
      a: { axis: 'z', range: [0, 2] },
      b: { axis: 'z', range: [0, 2] },
      c: { axis: 'x', range: [0, 3] },
      d: { axis: 'x', range: [4, 6] },
    },
  },
  {
    name: 'Traffic',
    grid: ['S#.#.#G', '..h....', '..a.b..'],
    blocks: {
      h: { axis: 'x', range: [2, 4] },
      a: { axis: 'z', range: [0, 2] },
      b: { axis: 'z', range: [0, 2] },
    },
  },
  {
    name: 'Rush Hour',
    grid: ['S#.#.#.#G', '..h...i..', '..a.b.c..'],
    blocks: {
      h: { axis: 'x', range: [2, 5] },
      i: { axis: 'x', range: [3, 6] },
      a: { axis: 'z', range: [0, 2] },
      b: { axis: 'z', range: [0, 2] },
      c: { axis: 'z', range: [0, 2] },
    },
  },
  {
    name: 'Detour',
    grid: ["......#G","..b.....","..##.##.",".#..ac..","S..e..fd"],
    blocks: {
      a: { axis: 'z', range: [1,3] },
      b: { axis: 'x', range: [2,7] },
      c: { axis: 'x', range: [1,5] },
      d: { axis: 'x', range: [1,7] },
      e: { axis: 'z', range: [1,4] },
      f: { axis: 'z', range: [1,4] },
    },
  },
  {
    name: 'Crossing Paths',
    grid: ["S.#.##..","...ea.#G",".f......",".c.d....","...b....","........","........"],
    blocks: {
      a: { axis: 'x', range: [2,5] },
      b: { axis: 'z', range: [0,4] },
      c: { axis: 'z', range: [0,4] },
      d: { axis: 'x', range: [0,6] },
      e: { axis: 'x', range: [0,4] },
      f: { axis: 'x', range: [0,3] },
    },
  },
  {
    name: 'Gridlock',
    grid: ["........","........","......b.",".a......","...c..f.","S..d..e.","#.#.##.G"],
    blocks: {
      a: { axis: 'z', range: [1,6] },
      b: { axis: 'z', range: [0,6] },
      c: { axis: 'z', range: [2,6] },
      d: { axis: 'x', range: [2,4] },
      e: { axis: 'x', range: [5,7] },
      f: { axis: 'x', range: [5,7] },
    },
  },
  {
    name: 'Long Way Round',
    grid: ["..#f#...","S#.gc#.G","...e..b.","...a....",".....d..","........","........"],
    blocks: {
      a: { axis: 'z', range: [0,6] },
      b: { axis: 'z', range: [0,5] },
      c: { axis: 'x', range: [0,7] },
      d: { axis: 'z', range: [0,4] },
      e: { axis: 'x', range: [1,4] },
      f: { axis: 'x', range: [0,6] },
      g: { axis: 'z', range: [0,2] },
    },
  },
  {
    name: 'Switchyard',
    grid: ["S.#.#.##.","...e....G",".f.a.....",".d.......",".......g.",".....b.c.","........."],
    blocks: {
      a: { axis: 'z', range: [0,4] },
      b: { axis: 'z', range: [0,5] },
      c: { axis: 'z', range: [1,6] },
      d: { axis: 'z', range: [0,6] },
      e: { axis: 'x', range: [0,5] },
      f: { axis: 'x', range: [0,4] },
      g: { axis: 'x', range: [5,8] },
    },
  },
  {
    name: 'Tangle',
    grid: ["..###...",".##.#...","##..c#..","#...b.#.","S.a.d.eG"],
    blocks: {
      a: { axis: 'x', range: [1,6] },
      b: { axis: 'z', range: [1,3] },
      c: { axis: 'x', range: [2,7] },
      d: { axis: 'z', range: [3,4] },
      e: { axis: 'z', range: [1,4] },
    },
  },
  {
    name: 'Clockwork',
    grid: ["...b.....","...f.....",".c.g.....",".e.......",".........",".d....a.G","S.#.##.#."],
    blocks: {
      a: { axis: 'z', range: [2,6] },
      b: { axis: 'z', range: [0,6] },
      c: { axis: 'z', range: [1,6] },
      d: { axis: 'x', range: [1,7] },
      e: { axis: 'x', range: [0,4] },
      f: { axis: 'x', range: [1,6] },
      g: { axis: 'x', range: [1,5] },
    },
  },
  {
    name: 'Labyrinth',
    grid: [".....a..","........","..c.....","..f..db.",".....ge.",".......G","S#.##.#."],
    blocks: {
      a: { axis: 'z', range: [0,6] },
      b: { axis: 'z', range: [2,5] },
      c: { axis: 'z', range: [1,6] },
      d: { axis: 'x', range: [4,6] },
      e: { axis: 'x', range: [5,7] },
      f: { axis: 'x', range: [0,4] },
      g: { axis: 'x', range: [4,7] },
    },
  },
  {
    name: 'Hocus Pocus',
    grid: [".#.#.#.","S.deg.G","....f..","b...a..",".......","..c...."],
    blocks: {
      a: { axis: 'z', range: [0,5] },
      b: { axis: 'z', range: [0,3] },
      c: { axis: 'z', range: [0,5] },
      d: { axis: 'x', range: [2,6] },
      e: { axis: 'z', range: [0,2] },
      f: { axis: 'x', range: [1,6] },
      g: { axis: 'z', range: [0,2] },
    },
  },
  {
    name: 'Master Class',
    grid: ["......##G","......#..","...#.#a..","S###..c..",".e#d.fg.b"],
    blocks: {
      a: { axis: 'x', range: [1,8] },
      b: { axis: 'x', range: [1,8] },
      c: { axis: 'z', range: [2,3] },
      d: { axis: 'z', range: [2,4] },
      e: { axis: 'z', range: [1,4] },
      f: { axis: 'z', range: [1,4] },
      g: { axis: 'z', range: [2,4] },
    },
  },
];

const slice = (a, b) => ALL.slice(a, b);

// ---- hand-made levels for the new mechanics -------------------------------------------------
// Rotor arm orientation: 0 = east, 1 = south, 2 = west, 3 = north. A tap turns it 90 degrees clockwise.
const TWIST = [
  {
    name: 'Turnstile',
    hint: 'Tap the block with the turn symbol to rotate it',
    grid: ['......', 'S#A.#G', '......'],
    blocks: { A: { type: 'rotor', arm: 3 } },
  },
  {
    name: 'Pair',
    grid: ['........', 'S#A..B#G', '........'],
    blocks: { A: { type: 'rotor', arm: 3 }, B: { type: 'rotor', arm: 1 } },
  },
];

const SWITCH = [
  {
    name: 'Weight',
    hint: 'Park a block on the plate to open the gate',
    grid: ['S##=#G', '..*.a.'],
    blocks: { a: { axis: 'x', range: [0, 5] } },
  },
  {
    name: 'Two Locks',
    grid: ['S#=#=#G', '.*.ab*.'],
    blocks: { a: { axis: 'x', range: [0, 6] }, b: { axis: 'x', range: [0, 6] } },
  },
  {
    name: 'The Long Way',
    hint: 'Arrow tiles can only be crossed in their direction',
    grid: ['S<<<<<G', '#.....#', '##.#.##', '..a.b..'],
    blocks: { a: { axis: 'z', range: [2, 3] }, b: { axis: 'z', range: [2, 3] } },
  },
  {
    name: 'Stairs',
    hint: 'Raised blocks bridge a height difference',
    grid: ['S.2G', '.a..'],
    goalH: 2,
    blocks: { a: { axis: 'z', range: [0, 1], h: 1 } },
  },
  {
    name: 'Ladder',
    grid: ['S.1.3G', '.a.b..'],
    goalH: 3,
    blocks: { a: { axis: 'z', range: [0, 1], h: 1 }, b: { axis: 'z', range: [0, 1], h: 2 } },
  },
];

import {
  GEN_TRICKY, GEN_TWIST, GEN_SWITCH, GEN_MASTER, GEN_SLIDE_EASY, GEN_TRICKY_EASY, GEN_TWIST_EASY, GEN_SWITCH_EASY, GEN_MASTER_RAMP,
} from './generated.js';
import { PARS } from './pars.js';

// Two early generated levels had a block that did nothing (found by tools/audit.mjs): dropped.
const DROPPED = new Set(['Long Way Round', 'Master Class']);
const TRICKY = [...slice(8, 18).filter((l) => !DROPPED.has(l.name)), ...GEN_TRICKY, ...GEN_TRICKY_EASY];

// Each pack is ordered easy -> hard by minimum moves (src/pars.js, regenerate with `npm run pars`).
const byPar = (levels) => levels.map((l, i) => ({ l, i })).sort((a, b) => (PARS[a.l.name] ?? 99) - (PARS[b.l.name] ?? 99) || a.i - b.i).map((x) => x.l);

export const PACKS = [
  { id: 'slide', name: 'Slide', theme: 'peach', levels: byPar([...slice(0, 8), ...GEN_SLIDE_EASY]) },
  { id: 'tricky', name: 'Tricky', theme: 'mint', levels: byPar(TRICKY) },
  { id: 'twist', name: 'Twist', theme: 'sun', levels: byPar([...TWIST, ...GEN_TWIST, ...GEN_TWIST_EASY]) },
  { id: 'switch', name: 'Switch & Flow', theme: 'dusk', levels: byPar([...SWITCH, ...GEN_SWITCH, ...GEN_SWITCH_EASY]) },
  { id: 'master', name: 'Master', theme: 'ice', levels: byPar([...GEN_MASTER_RAMP, ...GEN_MASTER]) },
];

// Flat list used by progress, level select and tools. Each entry knows its pack.
export const LEVELS = PACKS.flatMap((p, pack) => p.levels.map((l) => ({ ...l, pack })));
