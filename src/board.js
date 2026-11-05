import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blockCells, key, DIRS } from './logic.js';

export const STEP_H = 0.5; // world height of one level step
const SLAB = 0.4; // slab thickness
const GLOW = 0xffd166;

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function canvasTexture(draw) {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  draw(cv.getContext('2d'), s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const doubleArrow = () => canvasTexture((g) => {
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(10, 64); g.lineTo(42, 36); g.lineTo(42, 54); g.lineTo(86, 54); g.lineTo(86, 36); g.lineTo(118, 64);
  g.lineTo(86, 92); g.lineTo(86, 74); g.lineTo(42, 74); g.lineTo(42, 92); g.closePath(); g.fill();
});
const singleArrow = () => canvasTexture((g) => {
  g.fillStyle = '#6b4a3a';
  g.beginPath();
  g.moveTo(24, 50); g.lineTo(70, 50); g.lineTo(70, 30); g.lineTo(108, 64);
  g.lineTo(70, 98); g.lineTo(70, 78); g.lineTo(24, 78); g.closePath(); g.fill();
});
const turnArrow = () => canvasTexture((g, s) => {
  g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round';
  g.beginPath(); g.arc(s / 2, s / 2, 32, -Math.PI * 0.2, Math.PI * 1.35); g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(22, 40); g.lineTo(58, 36); g.lineTo(38, 72); g.closePath(); g.fill();
});

export class Board {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.geoCache = new Map();
    this.arrowTex = { double: doubleArrow(), single: singleArrow(), turn: turnArrow() };
    this.planeGeo = new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2);
    // depthWrite off: overlapping translucent rails (where two cross) would otherwise z-fight and shimmer
    this.railMat = new THREE.MeshBasicMaterial({
      color: 0x3d1f1f, transparent: true, opacity: 0.1, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    this.theme = null;
    this.reduced = false; // reduced motion: no intro animation
    this.reset();
  }

  reset() {
    this.tiles = new Map(); // key -> {mesh, mat}
    this.blocks = [];
    this.pickables = [];
    this.anim = [];
    this.gates = [];
    this.plates = [];
    this.glow = new Map(); // material -> target intensity
    this.hintObjs = [];
    this.targetMeshes = []; // tap-to-move markers
    this.selected = -1;
    this.time = 0;
    this.maxH = 0;
  }

  geo(h) {
    // slab for a tile at height h: a column reaching down to y = -SLAB
    const height = SLAB + h * STEP_H;
    if (!this.geoCache.has(height)) this.geoCache.set(height, new RoundedBoxGeometry(0.96, height, 0.96, 3, 0.06));
    return this.geoCache.get(height);
  }

  world(x, z, h = 0) {
    return new THREE.Vector3(x - this.ox, h * STEP_H, z - this.oz);
  }

  setTheme(theme) {
    this.theme = theme;
    for (const t of this.tiles.values()) if (t.role) t.mat.color.setHex(theme[t.role]);
    for (const b of this.blocks) b.mat.color.setHex(b.data.type === 'rotor' ? theme.rotor : theme.block);
    for (const g of this.gates) g.mat.color.setHex(theme.gate);
  }

  clear() {
    for (const c of [...this.group.children]) this.group.remove(c);
    this.reset();
  }

  makeMat(color) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, emissive: GLOW, emissiveIntensity: 0 });
    this.glow.set(m, 0);
    return m;
  }

  addAnimated(obj, delay) {
    obj.userData.baseY = obj.position.y;
    obj.userData.delay = this.reduced ? -10 : delay;
    if (!this.reduced) obj.scale.setScalar(0.001);
    this.anim.push(obj);
  }

  decal(tex, y, rotY = 0, opacity = 0.85) {
    const m = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity }));
    m.position.y = y;
    m.rotation.y = rotY;
    return m;
  }

  load(level, theme) {
    this.clear();
    this.level = level;
    this.ox = (level.W - 1) / 2;
    this.oz = (level.H - 1) / 2;
    this.theme = theme;

    // rails (faint grooves showing where each slider can go)
    for (const b of level.blocks) {
      if (b.type === 'rotor') continue;
      for (let p = b.min; p <= b.max; p++) {
        const c = blockCells(b, p)[0];
        const cell = level.cells.get(key(c.x, c.z));
        if (cell && cell.kind !== 'plate') continue;
        const w = this.world(c.x, c.z, b.h);
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(b.axis === 'x' ? 1 : 0.18, b.axis === 'x' ? 0.18 : 1).rotateX(-Math.PI / 2),
          this.railMat,
        );
        m.position.set(w.x, w.y - 0.01, w.z);
        this.group.add(m);
      }
    }

    // fixed cells
    let n = 0;
    for (const cell of level.cells.values()) {
      const { x, z, h, kind, dir } = cell;
      const isStart = x === level.start.x && z === level.start.z;
      const isGoal = x === level.goal.x && z === level.goal.z;
      const role = isStart ? 'start' : kind === 'plate' ? 'plate' : kind === 'gate' ? 'gate' : 'tile';
      const mat = this.makeMat(theme[role]);
      const mesh = new THREE.Mesh(this.geo(h), mat);
      const w = this.world(x, z, h);
      const height = SLAB + h * STEP_H;
      mesh.position.set(w.x, w.y - height / 2, w.z);
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
      this.tiles.set(key(x, z), { mesh, mat, role, cell });
      this.addAnimated(mesh, 0.04 * (x + z) + 0.02 * (n++ % 3));
      const top = height / 2 + 0.005;
      if (isGoal) this.addSlot(mesh, top);
      if (kind === 'plate') {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24),
          new THREE.MeshStandardMaterial({ color: 0x8c6a4a, roughness: 0.6, emissive: 0x6cf08a, emissiveIntensity: 0 }),
        );
        pad.position.y = top;
        mesh.add(pad);
        this.plates.push({ key: key(x, z), pad });
      }
      if (kind === 'gate') {
        mat.transparent = true;
        mat.opacity = 0.2;
        mesh.castShadow = false;
        this.gates.push({ mesh, mat, open: 0, baseY: mesh.position.y, goal: 0 });
      }
      if (dir >= 0) mesh.add(this.decal(this.arrowTex.single, top + 0.005, -dir * Math.PI / 2));
      this.maxH = Math.max(this.maxH, h);
    }

    // movable blocks
    level.blocks.forEach((b, i) => {
      this.maxH = Math.max(this.maxH, b.h);
      const mat = this.makeMat(b.type === 'rotor' ? theme.rotor : theme.block);
      const root = new THREE.Group(); // positioned at cell (slider) or pivot (rotor)
      const slab = (lx, lz) => {
        const m = new THREE.Mesh(this.geo(0), mat);
        m.position.set(lx, -SLAB / 2, lz);
        m.castShadow = m.receiveShadow = true;
        m.userData.index = i;
        root.add(m);
        this.pickables.push(m);
        return m;
      };
      const rec = { data: b, root, mat, vis: b.pos, target: b.pos, cum: b.pos, dragging: false, shake: 0 };
      const first = slab(0, 0);
      if (b.type === 'rotor') {
        const arm = slab(1, 0);
        // armHolder rotates around the pivot; the arm slab lives inside it
        const holder = new THREE.Group();
        root.remove(arm);
        holder.add(arm);
        root.add(holder);
        rec.holder = holder;
        const pivotDecal = this.decal(this.arrowTex.turn, 0.005, 0, 0.9);
        root.add(pivotDecal);
        holder.rotation.y = -b.pos * Math.PI / 2;
        const c = blockCells(b, b.pos)[0];
        const w = this.world(c.x, c.z, b.h);
        root.position.set(w.x, w.y, w.z);
      } else {
        first.add(this.decal(this.arrowTex.double, SLAB / 2 + 0.005, b.axis === 'z' ? Math.PI / 2 : 0));
        this.placeSlider(rec);
      }
      this.group.add(root);
      this.blocks.push(rec);
      this.addAnimated(root, 0.25 + 0.06 * i);
    });
    this.setTheme(theme);
    this.updateSupport(level.blocks.map((b) => b.pos));
  }

  addSlot(tile, top) {
    const hole = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.02, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x6b0f1a, roughness: 1 }),
    );
    hole.position.y = top;
    tile.add(hole);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.4, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe63946 }),
    );
    ring.position.y = top + 0.017;
    tile.add(ring);
  }

  placeSlider(rec) {
    const c = blockCells(rec.data, rec.vis)[0];
    const w = this.world(c.x, c.z, rec.data.h);
    rec.root.position.x = w.x;
    rec.root.position.z = w.z;
    if (rec.root.userData.baseY === undefined) rec.root.position.y = w.y;
    else rec.root.userData.baseY = w.y;
  }

  // ---- interaction state ------------------------------------------------------------
  setDrag(i, p) {
    const r = this.blocks[i];
    r.dragging = true;
    r.vis = p;
    r.target = p;
    this.placeSlider(r);
    r.root.userData.lift = 0.12;
  }

  release(i, p) {
    const r = this.blocks[i];
    r.dragging = false;
    r.target = p;
    r.root.userData.lift = 0;
  }

  // set a block's logical state (slider cell / rotor orientation) with animation
  setBlockState(i, p, animate = true) {
    const r = this.blocks[i];
    r.dragging = false;
    r.root.userData.lift = 0;
    if (r.data.type === 'rotor') {
      const cur = ((r.cum % 4) + 4) % 4;
      const d = (((p - cur + 2) % 4) + 4) % 4 - 2; // shortest turn
      r.cum += d;
      r.target = r.cum;
      if (!animate) r.vis = r.cum;
    } else {
      r.target = p;
      if (!animate) { r.vis = p; this.placeSlider(r); }
    }
  }

  shake(i) {
    this.blocks[i].shake = 0.35;
  }

  // covered plates glow, gates open when every plate is covered
  updateSupport(positions) {
    const covered = new Set();
    this.level.blocks.forEach((b, i) => blockCells(b, positions[i]).forEach((c) => covered.add(key(c.x, c.z))));
    for (const p of this.plates) p.pad.material.emissiveIntensity = covered.has(p.key) ? 0.9 : 0;
    const open = this.plates.length > 0 && this.plates.every((p) => covered.has(p.key));
    this.gates.forEach((g) => { g.goal = open ? 1 : 0; });
    if (this.gateState !== open) { this.gateState = open; return open; }
    return null;
  }

  // glow tiles/blocks along a path (null clears)
  highlightPath(path, positions) {
    for (const m of this.glow.keys()) this.glow.set(m, 0);
    if (!path) return;
    const keys = new Set(path.map((c) => key(c.x, c.z)));
    for (const k of keys) {
      const t = this.tiles.get(k);
      if (t && t.role !== 'gate') this.glow.set(t.mat, 0.45);
      else if (t) this.glow.set(t.mat, 0.45);
    }
    this.blocks.forEach((r, i) => {
      if (positions && blockCells(r.data, positions[i]).some((c) => keys.has(key(c.x, c.z)))) {
        this.glow.set(r.mat, 0.45);
      }
    });
  }

  // ---- drag ghost + tap-to-move markers ---------------------------------------------
  slabAt(b, p, mat, height = SLAB) {
    const c = blockCells(b, p)[0];
    const w = this.world(c.x, c.z, b.h);
    const m = new THREE.Mesh(this.geo(0), mat);
    m.scale.y = height / SLAB;
    m.position.set(w.x, w.y - SLAB / 2 + 0.02, w.z);
    this.group.add(m);
    return m;
  }

  // mark block i as selected and show where it can go; list = reachable slider cells
  select(i, list = []) {
    this.clearTargets();
    this.selected = i;
    if (i < 0) return;
    const r = this.blocks[i];
    if (!this.targetMat) this.targetMat = new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.55, depthWrite: false });
    for (const to of list) {
      const m = this.slabAt(r.data, to, this.targetMat, 0.3);
      m.userData.to = to;
      this.targetMeshes.push(m);
    }
  }

  clearTargets() {
    for (const m of this.targetMeshes) this.group.remove(m);
    this.targetMeshes = [];
    this.selected = -1;
  }

  // screen-space helper: world centre of every cell block i covers (for touch pick assist)
  blockAnchors(i, state) {
    const r = this.blocks[i];
    return blockCells(r.data, state).map((c) => {
      const w = this.world(c.x, c.z, r.data.h);
      return new THREE.Vector3(w.x, w.y - SLAB / 2, w.z);
    });
  }

  // ---- hint -------------------------------------------------------------------------
  showHint(move, positions) {
    this.clearHint();
    const r = this.blocks[move.i];
    r.hint = true;
    const ghostMat = new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.45 });
    const cells = blockCells(r.data, move.to);
    for (const c of cells) {
      const w = this.world(c.x, c.z, r.data.h);
      const g = new THREE.Mesh(this.geo(0), ghostMat);
      g.position.set(w.x, w.y - SLAB / 2 + 0.02, w.z);
      this.group.add(g);
      this.hintObjs.push(g);
    }
    if (r.data.type === 'rotor') r.hintTurn = true;
  }

  clearHint() {
    for (const g of this.hintObjs) this.group.remove(g);
    this.hintObjs = [];
    for (const r of this.blocks) { r.hint = false; r.hintTurn = false; }
  }

  // ---- per-frame --------------------------------------------------------------------
  update(dt) {
    this.time += dt;
    for (const o of this.anim) {
      const t = Math.min(Math.max((this.time - o.userData.delay) / 0.55, 0), 1);
      const e = easeOutBack(t);
      o.scale.setScalar(Math.max(e, 0.001));
      o.position.y = o.userData.baseY + (1 - Math.min(e, 1)) * -3 + (o.userData.lift || 0);
    }
    const k = Math.min(1, dt * 18);
    for (const r of this.blocks) {
      if (!r.dragging && Math.abs(r.target - r.vis) > 0.001) {
        r.vis += (r.target - r.vis) * k;
        if (r.data.type !== 'rotor') this.placeSlider(r);
      } else if (!r.dragging) {
        r.vis = r.target;
      }
      if (r.holder) r.holder.rotation.y = -r.vis * Math.PI / 2;
      // shake feedback
      if (r.shake > 0) {
        r.shake = Math.max(0, r.shake - dt);
        const off = Math.sin(r.shake * 60) * 0.05 * (r.shake / 0.35);
        if (r.data.type === 'rotor') r.root.rotation.z = off * 1.5;
        else {
          this.placeSlider(r);
          if (r.data.axis === 'x') r.root.position.x += off;
          else r.root.position.z += off;
        }
        r.wasShaking = true;
      } else if (r.wasShaking) {
        r.wasShaking = false;
        r.root.rotation.z = 0;
        if (r.data.type !== 'rotor') this.placeSlider(r);
      }
      // hint pulse / selection glow
      if (r.hint) {
        r.mat.emissiveIntensity = 0.35 + 0.35 * Math.sin(this.time * 7);
      } else if (this.selected === this.blocks.indexOf(r)) {
        r.mat.emissiveIntensity = 0.12 + 0.06 * Math.sin(this.time * 5);
      }
    }
    for (const [m, target] of this.glow) {
      if (this.blocks.some((r, bi) => (r.hint || bi === this.selected) && r.mat === m)) continue;
      m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 10);
    }
    if (this.targetMeshes.length) {
      const s = 0.92 + 0.06 * Math.sin(this.time * 6);
      for (const m of this.targetMeshes) { m.scale.x = m.scale.z = s; }
    }
    for (const g of this.gates) {
      g.open += (g.goal - g.open) * Math.min(1, dt * 8);
      g.mat.opacity = 0.2 + 0.8 * g.open;
      g.mesh.castShadow = g.open > 0.5;
    }
  }
}
