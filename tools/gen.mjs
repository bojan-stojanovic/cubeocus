// Level search. Usage: node tools/gen.mjs [tries] [minPar] [seed] [rotors] [plates 0|1]
// Prints JSON [{par, def}] of levels where every block matters, sorted by par.
import { searchLevels } from '../src/generator.js';

const [tries = 20000, minPar = 6, seed = 1, rotors = 0, plates = 0] = process.argv.slice(2).map(Number);
const found = searchLevels({ seed, tries, minPar, opts: { rotors, plates: !!plates } });
found.sort((a, b) => a.par - b.par);
console.error(`found ${found.length} levels (par >= ${minPar}, rotors=${rotors}, plates=${plates})`);
console.log(JSON.stringify(found));
