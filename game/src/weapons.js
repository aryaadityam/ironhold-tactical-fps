// IRONHOLD — weapons: the arsenal's look in the hand (viewmodels), its look in
// bot hands lives in characters.js, and the shared hitscan model both use.
// Accuracy is the game's promise: spread is tight standing still or crouched,

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { G } from './state.js';
import { rayVsWorld } from './world.js';
import { spawnTracer, muzzleFlash, impactFx } from './fx.js';
import { sfxShot, sfxDry, sfxReload, sfxHit, sfxKill, sfxHurt, sfxSwing } from './audio.js';
import { eyeHeight } from './physics.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3();
const _u = new THREE.Vector3(), _w = new THREE.Vector3();

export function currentWeaponId(f) {
  if (f.current === 'grenade') return null;
  return f.weapons[f.current];
}
export function ensureAmmo(f, id) {
  if (!f.ammo[id]) {
    const w = WEAPONS[id];
    f.ammo[id] = { mag: w.mag, reserve: w.reserve };
  }
  return f.ammo[id];
}

// Current spread in degrees for a fighter holding weapon w.
export function spreadDeg(f, w) {
  const speedF = Math.min(1.6, f.speed2d / 4.6);
  let s = w.spread * (1 + speedF * (w.moveSpread - 1));
  if (f.crouch) s *= 0.72;
  if (!f.grounded) s *= 2.1;
  s *= 1 + f.bloom * 1.9;
  return s;
}

// Perturb a direction by a random cone of half-angle deg, in place.
function perturb(dx, dy, dz, deg) {
  const a = deg * Math.PI / 180;
  _d.set(dx, dy, dz);
  _u.set(0, 1, 0);
  if (Math.abs(_d.y) > 0.95) _u.set(1, 0, 0);
  _w.crossVectors(_d, _u).normalize();
  _u.crossVectors(_w, _d).normalize();
  const r = Math.sqrt(Math.random()) * a, th = Math.random() * Math.PI * 2;
  _d.addScaledVector(_w, Math.cos(th) * r).addScaledVector(_u, Math.sin(th) * r).normalize();
  return _d;
}

// Distance from a ray to a vertical spine segment (a fighter's body), and the
function raySpine(ox, oy, oz, dx, dy, dz, fx, fy, fz, topY) {
  // Segment from (fx, fy+0.22, fz) to (fx, fy+topY, fz); the ray is a half-line.
  const sy = fy + 0.22, ey = fy + topY;
  // Closest points between ray (o + t d) and the vertical segment: solve in
  const rx = fx - ox, rz = fz - oz;
  const t = Math.max(0, rx * dx + rz * dz);
  const px = ox + dx * t, pz = oz + dz * t;
  const py = oy + dy * t;
  const cy = Math.max(sy, Math.min(ey, py));
  const ddx = px - fx, ddy = py - cy, ddz = pz - fz;
  return [Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz), t];
}

function falloff(w, dist) {
  if (dist <= w.falloffStart) return 1;
  if (dist >= w.falloffEnd) return 0.35;
  return 1 - 0.65 * (dist - w.falloffStart) / (w.falloffEnd - w.falloffStart);
}

// Apply damage with armour rules; returns true when the hit killed.
export function applyDamage(victim, dmg, head, attacker) {
  let rest = dmg;
  if (victim.armorHp > 0) {
    const absorbed = rest * (head && victim.armor < 2 ? 0 : 0.5);
    rest -= absorbed;
    victim.armorHp = Math.max(0, victim.armorHp - absorbed);
    if (victim.armorHp <= 0) victim.armor = 0;
  }
  victim.hp -= rest;
  victim.hitFlashUntil = performance.now() / 1000 + 0.09;
  victim.lastAttacker = attacker;
  if (victim.isPlayer) {
    G.playerHurt = { t: G.time, fromYaw: attacker ? Math.atan2(attacker.pos.x - victim.pos.x, attacker.pos.z - victim.pos.z) : victim.yaw };
    sfxHurt();
  }
  if (victim.hp <= 0 && victim.alive) {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.deadAt = performance.now() / 1000;
    if (attacker && attacker !== victim) {
      attacker.kills++;
      victim.killedBy = { id: attacker.id, weapon: attacker.currentWeaponId ?? currentWeaponId(attacker), head };
    }
    return true;
  }
  return false;
}

// One trigger pull. origin/dir are the shooter's eye and aim before spread.
export function tryFire(f, ox, oy, oz, dx, dy, dz, now) {
  const id = currentWeaponId(f);
  if (!id) return 'busy';
  const w = WEAPONS[id];
  if (now < f.nextShotAt || now < f.reloadUntil) return 'busy';
  if (id === 'golok') {
    f.nextShotAt = now + 60 / w.rpm;
    sfxSwing();
    let best = null, bestT = w.range;
    for (const e of G.fighters) {
      if (!e.alive || e.team === f.team) continue;
      const [dist, t] = raySpine(ox, oy, oz, dx, dy, dz, e.pos.x, e.pos.y, e.pos.z, e.crouch ? 0.95 : 1.3);
      if (dist < 0.55 && t < bestT) { best = e; bestT = t; }
    }
    if (best) {
      const killed = applyDamage(best, w.damage, false, f);
      impactFx(best.pos.x, best.pos.y + 1, best.pos.z, 'hit');
      if (f.isPlayer) { G.playerHitmark = { t: now, head: false, kill: killed }; sfxHit(false); if (killed) sfxKill(); }
    }
    return 'fired';
  }
  const ammo = ensureAmmo(f, id);
  if (ammo.mag <= 0) {
    sfxDry();
    f.nextShotAt = now + 0.3;
    startReload(f, now);
    return 'dry';
  }
  ammo.mag--;
  f.nextShotAt = now + 60 / w.rpm;
  f.bloom = Math.min(1, f.bloom + w.bloom);
  f.punch = Math.min(0.085, (f.punch || 0) + w.kick * 0.013);

  // Muzzle world position for the tracer and flash.
  if (f.isPlayer && f.viewMuzzle) f.viewMuzzle.getWorldPosition(_m);
  else if (f.muzzleObj) f.muzzleObj.getWorldPosition(_m);
  else _m.set(ox, oy - 0.1, oz);
  muzzleFlash(_m.x, _m.y, _m.z);
  const dist0 = f.isPlayer ? 0 : Math.hypot(G.player.pos.x - f.pos.x, G.player.pos.z - f.pos.z);
  sfxShot(id, Math.min(1, dist0 / 40));
  G.noises.push({ x: f.pos.x, z: f.pos.z, radius: 34, t: G.time });
  if (G.noises.length > 24) G.noises.shift();

  const spread = spreadDeg(f, w);
  for (let p = 0; p < w.pellets; p++) {
    const dir = perturb(dx, dy, dz, spread * (w.pellets > 1 ? 1 : 1));
    const worldDist = rayVsWorld(ox, oy, oz, dir.x, dir.y, dir.z, w.range);
    let bestF = null, bestT = worldDist, bestHead = false;
    for (const e of G.fighters) {
      if (!e.alive || e.team === f.team || e === f) continue;
      const topY = e.crouch ? 0.92 : 1.3;
      const [bd, bt] = raySpine(ox, oy, oz, dir.x, dir.y, dir.z, e.pos.x, e.pos.y, e.pos.z, topY);
      if (bd < 0.36 && bt > 0.4 && bt < bestT) { bestF = e; bestT = bt; bestHead = false; }
      // Head sphere.
      const hx = e.pos.x, hy = e.pos.y + (e.crouch ? 1.13 : 1.55), hz = e.pos.z;
      const rx = hx - ox, ry = hy - oy, rz = hz - oz;
      const th = rx * dir.x + ry * dir.y + rz * dir.z;
      if (th > 0.4 && th < bestT) {
        const cx = ox + dir.x * th - hx, cy = oy + dir.y * th - hy, cz = oz + dir.z * th - hz;
        if (cx * cx + cy * cy + cz * cz < 0.17 * 0.17) { bestF = e; bestT = th; bestHead = true; }
      }
    }
    const hx = ox + dir.x * bestT, hy = oy + dir.y * bestT, hz = oz + dir.z * bestT;
    spawnTracer(_m.x, _m.y, _m.z, hx, hy, hz);
    if (bestF) {
      const dmg = w.damage * falloff(w, bestT) * (bestHead ? w.headMult : 1);
      const killed = applyDamage(bestF, dmg, bestHead, f);
      impactFx(hx, hy, hz, 'hit');
      if (f.isPlayer) {
        G.playerHitmark = { t: now, head: bestHead, kill: killed };
        sfxHit(bestHead);
        if (killed) sfxKill();
      }
    } else if (worldDist < w.range) {
      impactFx(hx, hy, hz, Math.random() < 0.4 ? 'spark' : 'dust');
    }
  }
  if (ammo.mag === 0 && ammo.reserve > 0) startReload(f, now);
  return 'fired';
}

export function startReload(f, now) {
  const id = currentWeaponId(f);
  if (!id || id === 'golok') return false;
  const w = WEAPONS[id];
  const ammo = ensureAmmo(f, id);
  if (ammo.mag >= w.mag || ammo.reserve <= 0 || now < f.reloadUntil) return false;
  f.reloadUntil = now + w.reload;
  f.reloadId = id;
  sfxReload(0);
  return true;
}

// Per-step weapon upkeep: finish reloads, cool the spray bloom and the punch.
export function updateWeapons(f, now, dt) {
  if (f.reloadUntil && now >= f.reloadUntil) {
    const id = f.reloadId, w = WEAPONS[id], ammo = ensureAmmo(f, id);
    const take = Math.min(w.mag - ammo.mag, ammo.reserve);
    ammo.mag += take; ammo.reserve -= take;
    f.reloadUntil = 0;
    sfxReload(1);
  }
  f.bloom = Math.max(0, f.bloom - dt * 1.7);
  f.punch = (f.punch || 0) * Math.pow(0.0001, dt / 0.3);
}

// Viewmodels: the same arsenal, modelled properly for the first-person view —

const VM_MATS = {
  metal: new THREE.MeshStandardMaterial({ color: 0x31363d, roughness: 0.32, metalness: 0.65 }),
  poly: new THREE.MeshStandardMaterial({ color: 0x4a4436, roughness: 0.82 }),
  tan: new THREE.MeshStandardMaterial({ color: 0x8a6a34, roughness: 0.7 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.95 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xb08154, roughness: 0.7 }),
};
function vmBox(w, h, d, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.x = rx;
  return m;
}
function vmBarrel(r, len, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), VM_MATS.metal);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z);
  return m;
}
function vmArm(side) {
  // A gloved forearm reaching in from the lower corner to the grip.
  const g = new THREE.Group();
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.2, 3, 8), VM_MATS.glove);
  fore.rotation.x = Math.PI / 2.4;
  fore.position.set(0.05 * side, -0.1, 0.1);
  g.add(fore);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.055), VM_MATS.glove);
  hand.position.set(0.008 * side, -0.05, -0.045);
  hand.rotation.x = 0.25;
  g.add(hand);
  return g;
}

export function buildViewmodel(id) {
  const g = new THREE.Group();
  const M = VM_MATS;
  const muzzle = new THREE.Object3D();
  let magMesh = null;
  if (id === 'golok') {
    const blade = vmBox(0.012, 0.07, 0.34, new THREE.MeshStandardMaterial({ color: 0xaab2bc, roughness: 0.25, metalness: 0.75 }), 0, 0.01, -0.24);
    g.add(blade, vmBox(0.03, 0.1, 0.05, M.poly, 0, -0.03, -0.03), vmArm(1));
    muzzle.position.set(0, 0.01, -0.42);
  } else if (id === 'kijang') {
    g.add(vmBox(0.045, 0.075, 0.21, M.metal, 0, 0.03, -0.12));
    g.add(vmBox(0.04, 0.11, 0.055, M.poly, 0, -0.06, -0.02, 0.2));
    g.add(vmBarrel(0.016, 0.05, 0, 0.045, -0.24));
    g.add(vmBox(0.03, 0.025, 0.02, M.metal, 0, 0.075, -0.03));  // rear sight
    g.add(vmBox(0.012, 0.03, 0.02, M.metal, 0, 0.045, 0.005));  // hammer
    magMesh = vmBox(0.036, 0.09, 0.05, M.metal, 0, -0.1, -0.03, 0.2);
    g.add(magMesh, vmArm(1));
    muzzle.position.set(0, 0.045, -0.27);
  } else if (id === 'pecah' || id === 'kilat' || id === 'asap') {
    const can = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshStandardMaterial({ color: id === 'pecah' ? 0x4a5138 : id === 'kilat' ? 0xb9bdc4 : 0x707880, roughness: 0.4, metalness: 0.4 }));
    can.scale.set(1, 1.35, 1); can.position.set(0.02, -0.02, -0.16);
    g.add(can, vmArm(1));
    muzzle.position.set(0.02, 0, -0.2);
  } else {
    const L = { rusa: 0.52, badak: 0.8, banteng: 0.74, elang: 0.86, cendrawasih: 1.18 }[id];
    g.add(vmBox(0.06, 0.11, L * 0.5, M.metal, 0, 0.01, -L * 0.28));  // receiver
    g.add(vmBox(0.052, 0.07, L * 0.34, M.poly, 0, -0.005, -L * 0.62));  // handguard
    g.add(vmBarrel(id === 'cendrawasih' ? 0.024 : 0.018, L * 0.4, 0, 0.035, -L * 0.78)); // barrel
    g.add(vmBox(0.055, 0.1, L * 0.2, M.poly, 0, -0.01, L * 0.06));  // stock
    g.add(vmBox(0.04, 0.1, 0.05, M.poly, 0, -0.09, -L * 0.05, 0.25));  // grip
    magMesh = vmBox(0.042, 0.16, 0.07, M.metal, 0, -0.13, -L * 0.22, 0.12);
    const magTip = vmBox(0.04, 0.11, 0.065, M.metal, 0, -0.1, 0.014, 0.24);
    magMesh.add(magTip);  // curved magazine foot
    g.add(magMesh);
    for (let ri = 0; ri < 4; ri++) g.add(vmBox(0.034, 0.02, 0.05, M.metal, 0, 0.045, -L * (0.48 + ri * 0.09))); // rail segments
    g.add(vmBox(0.008, 0.055, 0.01, M.metal, 0, 0.07, -L * 0.9));  // front sight post
    g.add(vmBarrel(0.028, 0.085, 0, 0.035, -L * 0.96));  // muzzle brake
    g.add(vmBox(0.006, 0.032, 0.1, M.poly, 0.033, 0.028, -L * 0.18));  // ejection port
    g.add(vmBox(0.05, 0.02, 0.035, M.metal, 0, 0.05, L * 0.13));  // charging handle
    if (id === 'rusa') g.add(vmBarrel(0.03, 0.14, 0, 0.035, -L * 0.95));  // suppressor
    if (id === 'badak') {
      g.add(vmBarrel(0.02, L * 0.52, 0, -0.025, -L * 0.58));  // tube magazine
      g.add(vmBox(0.05, 0.05, 0.16, M.tan, 0, -0.055, -L * 0.6));  // pump
      g.add(vmBox(0.065, 0.03, L * 0.4, M.metal, 0, 0.075, -L * 0.55));  // heat shield
    }
    if (id === 'banteng') g.add(vmBox(0.03, 0.05, 0.2, M.metal, 0, 0.095, -L * 0.3));  // carry handle
    if (id === 'elang') g.add(vmBox(0.025, 0.055, 0.09, M.metal, 0, 0.09, -L * 0.3));  // reflex sight
    if (id === 'cendrawasih') {
      const scope = vmBarrel(0.026, 0.2, 0, 0.1, -L * 0.3);
      g.add(scope, vmBox(0.02, 0.04, 0.05, M.metal, 0, 0.06, -L * 0.3));
      g.add(vmBox(0.015, 0.12, 0.015, M.metal, -0.05, -0.1, -L * 0.85), vmBox(0.015, 0.12, 0.015, M.metal, 0.05, -0.1, -L * 0.85)); // bipod
    }
    g.add(vmArm(1));  // trigger arm
    const fore = vmArm(-1); fore.position.set(-0.03, -0.015, -L * 0.55); g.add(fore);  // support arm, fist under the guard
    muzzle.position.set(0, 0.035, -L * (id === 'rusa' ? 1.05 : 0.99));
  }
  g.add(muzzle);
  g.userData = { muzzle, magMesh };
  return g;
}
