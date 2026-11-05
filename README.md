# Cubeocus

Isometric puzzle game (Three.js + Vite). Slide and turn blocks so the red cube has a path to its slot.

```
npm install
npm run dev      # play at http://localhost:5173
npm run build    # output in dist/ (relative paths: works from any folder, e.g. Laragon /hocus/dist/)
npm run check    # every level solvable + no block that does nothing
npm run pars     # after adding levels: regenerate src/pars.js (orders each pack easy -> hard)
```

## Mechanics
- **Slider** (blue): drag along its rail, or tap it and then tap a highlighted cell.
- **Rotor** (marked with a turn symbol): tap to turn the arm 90 degrees clockwise.
- **Plate / gate:** a block resting on every plate opens the gates.
- **Arrow tiles:** can only be crossed along the arrow.
- **Heights:** the cube can step up or down one level at a time; raised blocks bridge height gaps.
- Settings (gear): reduce motion, colour-blind palette, large controls, vibration.
- Undo (`Ctrl+Z` / `U`), hint (`H`, caps the level at 2 stars), restart (`R`), Daily puzzle (seeded by date).

## Layout
- `src/logic.js` rules + solver (pure, runs in Node), `src/levels.js` packs, `src/generated.js` generated levels
- `src/generator.js` seeded level generator (used by `tools/gen.mjs` and the Daily puzzle worker)
- `src/board.js`, `src/cube.js`, `src/main.js`, `src/ui.js`, `src/audio.js`, `src/themes.js`
- `tools/solve.mjs` par per level, `tools/audit.mjs` useless-block check, `tools/gen.mjs` level search
