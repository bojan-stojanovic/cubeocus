// Visual themes, one per level pack. `css` values go to CSS variables, hex numbers to three.js materials.
export const THEMES = {
  peach: {
    css: { bg1: '#fbe9d7', bg2: '#f6c1b6', ink: '#4a2c2c', panel: '#fffaf0', chip: '#ffffff', chipInk: '#4a2c2c' },
    tile: 0xfff4e0, start: 0xffd9cf, block: 0x3d5a80, rotor: 0xe07a1f, gate: 0x2a9d8f, plate: 0xe8d5b5,
    sky: 0xffffff, ground: 0xf0c4b8,
  },
  mint: {
    css: { bg1: '#e6f6ec', bg2: '#a6d9c4', ink: '#1f4a3d', panel: '#f6fff9', chip: '#ffffff', chipInk: '#1f4a3d' },
    tile: 0xf6fff9, start: 0xd2f0df, block: 0x2f4b7c, rotor: 0xef8354, gate: 0xc44569, plate: 0xcfe8da,
    sky: 0xffffff, ground: 0xa6d9c4,
  },
  sun: {
    css: { bg1: '#fff3c4', bg2: '#ffb877', ink: '#5a3410', panel: '#fffbea', chip: '#ffffff', chipInk: '#5a3410' },
    tile: 0xfffbef, start: 0xffe2b8, block: 0x6a4c93, rotor: 0x1982c4, gate: 0x2a9d8f, plate: 0xf1dfae,
    sky: 0xffffff, ground: 0xffc58c,
  },
  dusk: {
    css: { bg1: '#2d2a5a', bg2: '#7b4b94', ink: '#f6ecff', panel: '#3b3770', chip: '#4b4688', chipInk: '#f6ecff' },
    tile: 0xe9e1f7, start: 0xf2c6d8, block: 0x4cc9f0, rotor: 0xffb703, gate: 0x80ed99, plate: 0xb9a9d6,
    sky: 0xd9ccff, ground: 0x4b3a78,
  },
  ice: {
    css: { bg1: '#e8f1ff', bg2: '#b3cdf0', ink: '#1e3552', panel: '#f7faff', chip: '#ffffff', chipInk: '#1e3552' },
    tile: 0xf7fbff, start: 0xdbe8fb, block: 0x34495e, rotor: 0xff7f50, gate: 0x06d6a0, plate: 0xc9d9ee,
    sky: 0xffffff, ground: 0xb3cdf0,
  },
};

export function applyCss(theme) {
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(theme.css)) r.setProperty('--' + k, v);
}
