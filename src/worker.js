// Builds the Daily puzzle off the main thread.
import { searchLevels } from './generator.js';

self.onmessage = (e) => {
  const { seed, opts, minPar } = e.data;
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = searchLevels({ seed: seed + attempt * 7919, tries: 60000, minPar: minPar - Math.floor(attempt / 3), want: 1, opts });
    if (r.length) { self.postMessage(r[0]); return; }
  }
  self.postMessage(null);
};
