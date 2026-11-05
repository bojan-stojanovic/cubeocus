import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { sfx } from './audio.js';

const SIZE = 0.56;
const REST_Y = SIZE / 2;
const STEP_T = 0.27;
const RED = 0xe63946;
const ease = (t) => t * t * (3 - 2 * t);

export class Cube {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Mesh(
      new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.08),
      new THREE.MeshStandardMaterial({ color: RED, roughness: 0.35 }),
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    this.pMat = new THREE.MeshStandardMaterial({ color: RED });
    this.pWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.particles = [];
    this.phase = 'idle';
    this.appearT = 1;
    this.reduced = false; // reduced motion: appear instantly, no confetti
  }

  // v: world position of the start tile's top surface
  place(v, delay = 0.7) {
    this.mesh.position.set(v.x, v.y + REST_Y, v.z);
    this.mesh.quaternion.identity();
    this.mesh.visible = true;
    this.phase = 'idle';
    this.appearDelay = delay;
    this.appearT = this.reduced ? 1 : 0;
    this.mesh.scale.setScalar(this.reduced ? 1 : 0.001);
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
  }

  // Roll along `route` (world Vector3 tile tops). Resolves when the cube is in the slot.
  run(route) {
    return new Promise((resolve) => {
      this.route = route;
      this.i = 0;
      this.t = 0;
      this.phase = 'move';
      this.resolve = resolve;
      this.q0 = this.mesh.quaternion.clone();
    });
  }

  burst(pos) {
    if (this.reduced) return;
    for (let k = 0; k < 28; k++) {
      const m = new THREE.Mesh(this.pGeo, k % 3 ? this.pMat : this.pWhite);
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 2;
      this.scene.add(m);
      this.particles.push({ mesh: m, v: new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 2.5, Math.sin(a) * sp), life: 1 });
    }
  }

  update(dt) {
    if (this.appearT < 1) {
      this.appearDelay -= dt;
      if (this.appearDelay <= 0) {
        this.appearT = Math.min(1, this.appearT + dt / 0.35);
        this.mesh.scale.setScalar(Math.max(ease(this.appearT), 0.001));
      }
    }

    if (this.phase === 'move') {
      const a = this.route[this.i];
      const b = this.route[this.i + 1];
      this.t += dt / STEP_T;
      const t = Math.min(this.t, 1);
      const e = ease(t);
      const hop = Math.sin(Math.PI * t) * (0.16 + Math.max(0, b.y - a.y) * 0.6);
      this.mesh.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e + REST_Y + hop, a.z + (b.z - a.z) * e);
      const axis = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x));
      const q = new THREE.Quaternion().setFromAxisAngle(axis, (Math.PI / 2) * e);
      this.mesh.quaternion.copy(q.multiply(this.q0));
      if (this.t >= 1) {
        this.q0.copy(this.mesh.quaternion);
        this.i++;
        this.t = 0;
        sfx.step(this.i);
        if (this.i >= this.route.length - 1) { this.phase = 'sink'; sfx.sink(); }
      }
    } else if (this.phase === 'sink') {
      this.t += dt / 0.5;
      const e = ease(Math.min(this.t, 1));
      const goal = this.route[this.route.length - 1];
      this.mesh.position.set(goal.x, goal.y + REST_Y - e * 0.5, goal.z);
      this.mesh.scale.setScalar(1 - e * 0.25);
      if (this.t >= 1) {
        this.phase = 'done';
        this.burst(new THREE.Vector3(goal.x, goal.y + 0.3, goal.z));
        sfx.win();
        this.resolve();
      }
    }

    for (let k = this.particles.length - 1; k >= 0; k--) {
      const p = this.particles[k];
      p.life -= dt / 1.1;
      p.v.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.scale.setScalar(Math.max(p.life, 0.001));
      p.mesh.rotation.x += dt * 6;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(k, 1); }
    }
  }
}
