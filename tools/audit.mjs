// Run: node tools/audit.mjs  -> fails if any shipped level has a block that does nothing.
import { LEVELS } from '../src/levels.js';
import { parseLevel, uselessBlocks } from '../src/logic.js';

let bad = 0;
LEVELS.forEach((def, i) => {
  const lvl = parseLevel(def);
  const dead = uselessBlocks(lvl).map((b) => lvl.blocks[b].id);
  if (dead.length) { bad++; console.log(`${i + 1}. ${def.name}: useless blocks -> ${dead.join(', ')}`); }
});
console.log(bad ? `${bad} level(s) with useless blocks` : 'audit ok: every block matters');
process.exit(bad ? 1 : 0);
