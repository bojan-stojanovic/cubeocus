// Run: node tools/solve.mjs   -> prints the minimum number of drags for every level.
import { LEVELS } from '../src/levels.js';
import { parseLevel, solve } from '../src/logic.js';

let bad = 0;
LEVELS.forEach((def, i) => {
  const par = solve(parseLevel(def));
  if (par < 0) bad++;
  console.log(`${i + 1}. ${def.name.padEnd(20)} par = ${par}${par < 0 ? '  <-- UNSOLVABLE' : ''}`);
});
process.exit(bad ? 1 : 0);
