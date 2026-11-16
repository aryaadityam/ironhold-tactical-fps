// IRONHOLD — the fighters' bodies: smooth-shaded low-poly soldiers built from
// capsules, cylinders and spheres (never boxes for limbs), with helmets, plate
// vests in team colours, a posed weapon arm and a simple procedural walk cycle.

import * as THREE from 'three';
import { getTexture } from './textures.js';
import { TEAM_COLOR } from './config.js';

const capsule = (r, len, mat) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 10), mat);
  m.castShadow = true;
  return m;
};
const ball = (r, mat) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
  m.castShadow = true;
  return m;
};
const box = (w, h, d, mat) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
};

// A simplified long-arm silhouette for a bot's hands, by weapon class: enough
export function buildBotGun(weaponId) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.45, metalness: 0.4 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x33302c, roughness: 0.8 });
  const len = { kijang: 0.24, rusa: 0.52, badak: 0.78, banteng: 0.72, elang: 0.82, cendrawasih: 1.15, golok: 0.3 }[weaponId] ?? 0.7;
  if (weaponId === 'golok') {
    const blade = box(0.02, 0.09, 0.3, new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.3, metalness: 0.7 }));
    blade.position.set(0, 0, 0.18); g.add(blade);
    return g;
  }
  if (weaponId === 'kijang') {
    const slide = box(0.05, 0.09, 0.22, metal); slide.position.set(0, 0.02, 0.08); g.add(slide);
    const grip = box(0.045, 0.13, 0.06, poly); grip.position.set(0, -0.07, -0.02); grip.rotation.x = 0.25; g.add(grip);
    g.userData.muzzle = new THREE.Object3D(); g.userData.muzzle.position.set(0, 0.03, 0.2); g.add(g.userData.muzzle);
    return g;
  }
  const receiver = box(0.07, 0.13, len * 0.52, metal); receiver.position.z = len * 0.1; g.add(receiver);
  const guard = box(0.06, 0.09, len * 0.3, poly); guard.position.set(0, 0.005, len * 0.42); g.add(guard);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, len * 0.5, 8), metal);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, len * 0.36 + len * 0.22); barrel.castShadow = true; g.add(barrel);
  const mag = box(0.05, 0.17, 0.08, poly); mag.position.set(0, -0.13, len * 0.08); mag.rotation.x = 0.15; g.add(mag);
  const stock = box(0.055, 0.11, len * 0.24, poly); stock.position.set(0, -0.01, -len * 0.3); g.add(stock);
  const sight = box(0.03, 0.06, 0.1, metal); sight.position.set(0, 0.1, len * 0.05); g.add(sight);
  if (weaponId === 'cendrawasih') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 8), metal);
    scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.11, 0.02); g.add(scope);
  }
  g.userData.muzzle = new THREE.Object3D();
  g.userData.muzzle.position.set(0, 0.03, len * 0.36 + len * 0.48);
  g.add(g.userData.muzzle);
  return g;
}

export function buildFighterMesh(team, name) {
  const accent = new THREE.MeshStandardMaterial({
    map: getTexture('metalPlate'), color: TEAM_COLOR[team], roughness: 0.55, metalness: 0.25,
  });
  const uniform = new THREE.MeshStandardMaterial({ color: team === 0 ? 0x44554e : 0x554844, roughness: 0.95 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x39404a, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb08154, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6, metalness: 0.2 });

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // Pelvis and torso: a tapered cylinder under a plate vest.
  const pelvis = box(0.33, 0.2, 0.21, cloth); pelvis.position.y = 0.94; body.add(pelvis);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.185, 0.52, 12), uniform);
  torso.position.y = 1.29; torso.castShadow = true; body.add(torso);
  const vest = box(0.37, 0.4, 0.25, accent); vest.position.set(0, 1.3, 0.01); body.add(vest);
  const chestRig = box(0.26, 0.2, 0.05, dark); chestRig.position.set(0, 1.3, 0.15); body.add(chestRig);
  for (const px of [-0.085, 0, 0.085]) {
    const pouch = box(0.07, 0.12, 0.045, dark); pouch.position.set(px, 1.26, 0.185); body.add(pouch);
  }
  const pack = box(0.3, 0.37, 0.15, cloth); pack.position.set(0, 1.32, -0.19); body.add(pack);
  const radio = box(0.07, 0.12, 0.05, dark); radio.position.set(0.17, 1.44, -0.1); body.add(radio);

  // Head: skull, helmet shell with a brim, dark visor strip.
  const headG = new THREE.Group(); headG.position.y = 1.56; body.add(headG);
  const skull = ball(0.125, skin); skull.position.y = 0.09; headG.add(skull);
  const helmet = ball(0.148, dark); helmet.scale.set(1, 0.78, 1); helmet.position.y = 0.145; headG.add(helmet);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.172, 0.028, 14), dark);
  brim.position.y = 0.105; brim.castShadow = true; headG.add(brim);
  const stripe = box(0.05, 0.05, 0.3, accent); stripe.position.y = 0.245; headG.add(stripe);
  const visor = box(0.17, 0.05, 0.02, new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.25, metalness: 0.4 }));
  visor.position.set(0, 0.09, 0.115); headG.add(visor);

  // Arms: shoulders pivot; both reach forward to the gun in a ready pose.
  function arm(side) {
    const sh = new THREE.Group();
    sh.position.set(0.235 * side, 1.47, 0);
    const upper = capsule(0.055, 0.2, uniform); upper.position.y = -0.15; sh.add(upper);
    const pad = ball(0.075, accent); pad.position.y = -0.02; sh.add(pad);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const fore = capsule(0.048, 0.18, uniform); fore.position.y = -0.13; el.add(fore);
    const hand = ball(0.05, dark); hand.position.y = -0.29; el.add(hand);
    body.add(sh);
    return { sh, el };
  }
  const armR = arm(-1), armL = arm(1);
  armR.sh.rotation.set(-1.25, 0, 0.18); armR.el.rotation.x = -0.35;
  armL.sh.rotation.set(-1.45, 0, -0.3); armL.el.rotation.x = -0.55;

  // The gun sits in the hands, pointing the way the body faces (+z local).
  const gunAnchor = new THREE.Group();
  gunAnchor.position.set(0.05, 1.36, 0.3);
  body.add(gunAnchor);

  // Legs: hip pivots, thigh and shin capsules, boot boxes.
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.105 * side, 0.94, 0);
    const thigh = capsule(0.07, 0.26, cloth); thigh.position.y = -0.2; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    const kpad = box(0.11, 0.13, 0.05, dark); kpad.position.set(0, -0.03, 0.075); knee.add(kpad);
    const shin = capsule(0.058, 0.26, cloth); shin.position.y = -0.18; knee.add(shin);
    const boot = box(0.11, 0.08, 0.26, dark); boot.position.set(0, -0.4, 0.05); knee.add(boot);
    body.add(hip);
    return { hip, knee };
  }
  const legL = leg(1), legR = leg(-1);

  // Team chevron floating above the head: reads at a glance in a firefight.
  const chev = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 4),
    new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team] }));
  chev.rotation.x = Math.PI;
  chev.position.y = 2.02;
  group.add(chev);

  group.userData = { body, headG, armR, armL, legL, legR, gunAnchor, chev, accent, uniform };
  return group;
}

// Attach (or swap) the gun a fighter currently holds.
export function setFighterGun(f, weaponId) {
  const u = f.group.userData;
  if (u.gun) u.gunAnchor.remove(u.gun);
  u.gun = buildBotGun(weaponId);
  u.gunAnchor.add(u.gun);
  f.muzzleObj = u.gun.userData.muzzle ?? null;
}

// Pose a fighter's mesh from its simulation record.
const _e = new THREE.Euler();
export function syncFighterMesh(f, dt, t) {
  const g = f.group;
  if (!g) return;
  const u = g.userData;
  g.position.set(f.pos.x, f.pos.y, f.pos.z);
  g.rotation.set(0, f.yaw, 0);
  const speedF = Math.min(1, f.speed2d / 4.4);

  if (!f.alive) {
    // Fall where killed: tip backward over 0.35 s, then rest.
    const k = Math.min(1, (performance.now() / 1000 - f.deadAt) / 0.35);
    g.rotation.x = -Math.PI / 2 * k * 0.96;
    g.position.y = f.pos.y + 0.12 * k;
    u.chev.visible = false;
    return;
  }
  g.rotation.x = 0;
  u.chev.visible = !f.isPlayer;
  u.chev.position.y = 2.02 + Math.sin(t * 2.4 + f.id) * 0.03;

  f.walkPhase += dt * (2.2 + f.speed2d * 1.55);
  const swing = Math.sin(f.walkPhase) * 0.62 * speedF;
  const bend = Math.max(0, -Math.cos(f.walkPhase)) * 0.85 * speedF;
  const bend2 = Math.max(0, Math.cos(f.walkPhase)) * 0.85 * speedF;
  if (f.crouch) {
    u.body.position.y = -0.33;
    u.legL.hip.rotation.x = -1.85; u.legL.knee.rotation.x = 2.0;
    u.legR.hip.rotation.x = -0.5; u.legR.knee.rotation.x = 1.15;
  } else {
    u.body.position.y = Math.abs(Math.sin(f.walkPhase)) * 0.035 * speedF;
    u.legL.hip.rotation.x = swing; u.legL.knee.rotation.x = bend;
    u.legR.hip.rotation.x = -swing; u.legR.knee.rotation.x = bend2;
  }
  // Aim pitch leans the whole upper body a little, so a bot tracking a target
  u.body.rotation.x = THREE.MathUtils.clamp(f.pitch, -0.6, 0.6) * 0.45;
  u.headG.rotation.x = THREE.MathUtils.clamp(f.pitch, -0.6, 0.6) * 0.4;
  // Hit flash: a brief emissive lift on the vest.
  const flash = f.hitFlashUntil && performance.now() / 1000 < f.hitFlashUntil ? 0.55 : 0;
  u.accent.emissive.setRGB(flash, flash * 0.4, flash * 0.3);
}
