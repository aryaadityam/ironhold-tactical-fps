// IRONHOLD — visual effects, all pooled: tracers, muzzle flashes, impact puffs,
// spark bursts, explosion fireballs, smoke clouds, grenade bodies and the
// breaching-charge device in its three states (carried, dropped, planted).

import * as THREE from 'three';
import { softCircleTexture } from './textures.js';
import { G } from './state.js';

let scene = null;
const tracers = [], puffs = [], smokesFx = [];
let flashLight = null, flashSprite = null, flashLife = 0;
let sparkGeo, sparkPos, sparkVel, sparkLife;
const SPARKS = 220;
let carriedMesh, droppedMesh, plantedMesh, plantedLight;

function makeSprite(color, scale, opacity, additive = false) {
  const m = new THREE.SpriteMaterial({
    map: softCircleTexture(), color, transparent: true, opacity,
    depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  s.visible = false;
  scene.add(s);
  return s;
}

export function initFx(s) {
  scene = s;
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 40; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, tracerMat);
    line.visible = false; line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  for (let i = 0; i < 46; i++) {
    const sp = makeSprite(0xffffff, 0.3, 0.5);
    puffs.push({ sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0, fade: 0.5 });
  }
  flashSprite = makeSprite(0xffc37a, 0.55, 0.95, true);
  flashLight = new THREE.PointLight(0xffb36b, 0, 11, 1.6);
  scene.add(flashLight);

  sparkPos = new Float32Array(SPARKS * 3);
  sparkVel = new Float32Array(SPARKS * 3);
  sparkLife = new Float32Array(SPARKS);
  sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xffcf8a, size: 0.05, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  for (let i = 0; i < SPARKS; i++) sparkPos[i * 3 + 1] = -50;

  // The breaching charge in its three states.
  const body = new THREE.MeshStandardMaterial({ color: 0x2c2f26, roughness: 0.6, metalness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.5 });
  const mkCharge = () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.14), body); b.castShadow = true; g.add(b);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.16), trim); t.position.y = 0.14; g.add(t);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 6), body);
    ant.position.set(0.12, 0.34, 0); g.add(ant);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2211, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), lampMat);
    lamp.position.set(0.12, 0.52, 0); g.add(lamp);
    g.userData.lampMat = lampMat;
    g.visible = false;
    scene.add(g);
    return g;
  };
  carriedMesh = mkCharge();
  droppedMesh = mkCharge();
  plantedMesh = mkCharge();
  plantedLight = new THREE.PointLight(0xff3322, 0, 6, 2);
  scene.add(plantedLight);
}

export function spawnTracer(ax, ay, az, bx, by, bz) {
  for (const t of tracers) {
    if (t.life > 0) continue;
    const p = t.line.geometry.attributes.position;
    p.setXYZ(0, ax, ay, az); p.setXYZ(1, bx, by, bz);
    p.needsUpdate = true;
    t.line.visible = true;
    t.life = 0.055;
    return;
  }
}

export function muzzleFlash(x, y, z) {
  flashSprite.position.set(x, y, z);
  flashSprite.material.rotation = Math.random() * 6.28;
  flashSprite.scale.setScalar(0.4 + Math.random() * 0.3);
  flashSprite.visible = true;
  flashLife = 0.05;
  flashLight.position.set(x, y, z);
  flashLight.intensity = 30;
}

function puff(x, y, z, color, scale, life, vx, vy, vz, grow, opacity) {
  for (const p of puffs) {
    if (p.life > 0) continue;
    p.sp.position.set(x, y, z);
    p.sp.material.color.setHex(color);
    p.sp.material.opacity = opacity;
    p.sp.scale.setScalar(scale);
    p.sp.visible = true;
    p.life = life; p.max = life;
    p.vx = vx; p.vy = vy; p.vz = vz; p.grow = grow; p.fade = opacity;
    return;
  }
}

export function impactFx(x, y, z, kind) {
  if (kind === 'hit') {
    puff(x, y, z, 0x8a2320, 0.22, 0.3, 0, 0.5, 0, 1.4, 0.75);
    puff(x, y, z, 0x5d1712, 0.15, 0.22, 0.3, 0.2, 0, 1.2, 0.7);
  } else if (kind === 'spark') {
    burstSparks(x, y, z, 5, 2.6);
    puff(x, y, z, 0xd8c9a8, 0.16, 0.25, 0, 0.4, 0, 1.6, 0.5);
  } else {
    puff(x, y, z, 0x9a8d76, 0.3, 0.5, 0, 0.5, 0, 2.2, 0.42);
    puff(x, y, z, 0x7d7261, 0.2, 0.4, 0.4, 0.3, 0.2, 2.0, 0.4);
  }
}

let sparkCursor = 0;
export function burstSparks(x, y, z, n, power) {
  for (let k = 0; k < n; k++) {
    const i = sparkCursor; sparkCursor = (sparkCursor + 1) % SPARKS;
    sparkPos[i * 3] = x; sparkPos[i * 3 + 1] = y; sparkPos[i * 3 + 2] = z;
    sparkVel[i * 3] = (Math.random() - 0.5) * power;
    sparkVel[i * 3 + 1] = Math.random() * power * 0.9;
    sparkVel[i * 3 + 2] = (Math.random() - 0.5) * power;
    sparkLife[i] = 0.3 + Math.random() * 0.3;
  }
}

export function explosionFx(x, y, z) {
  puff(x, y + 0.4, z, 0xffa845, 1.6, 0.22, 0, 1, 0, 6, 0.95);
  puff(x, y + 0.5, z, 0xff7733, 1.1, 0.3, 0, 1.4, 0, 5, 0.9);
  for (let i = 0; i < 7; i++) {
    puff(x + (Math.random() - 0.5) * 1.6, y + 0.4 + Math.random() * 0.8, z + (Math.random() - 0.5) * 1.6,
      0x4a4038, 0.9, 1.1 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2, 1.1, (Math.random() - 0.5) * 1.2, 2.6, 0.55);
  }
  burstSparks(x, y + 0.4, z, 26, 6);
  flashLight.position.set(x, y + 0.8, z);
  flashLight.intensity = 260;
  flashLife = 0.22;
}

export function spawnSmokeFx(x, y, z, r, seconds) {
  const group = [];
  for (let i = 0; i < 11; i++) {
    const sp = makeSprite(0xb9bcc2, 0.5, 0);
    const a = (i / 11) * 6.28, rr = r * (0.25 + (i % 4) * 0.22);
    sp.position.set(x + Math.cos(a) * rr, y + 0.5 + (i % 3) * 0.55, z + Math.sin(a) * rr);
    sp.userData.baseScale = r * (0.9 + (i % 3) * 0.3);
    group.push(sp);
  }
  smokesFx.push({ group, life: seconds, max: seconds, r });
}

const GRENADE_COLORS = { pecah: 0x4a5138, kilat: 0xb9bdc4, asap: 0x707880 };
export function attachGrenadeMesh(g) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshStandardMaterial({ color: GRENADE_COLORS[g.kind], roughness: 0.4, metalness: 0.4 }));
  m.scale.y = 1.35;
  m.castShadow = true;
  scene.add(m);
  g.mesh = m;
}
export function detachGrenadeMesh(g) {
  if (g.mesh) { scene.remove(g.mesh); g.mesh = null; }
}

export function tickFx(dt, t) {
  for (const tr of tracers) {
    if (tr.life <= 0) continue;
    tr.life -= dt;
    if (tr.life <= 0) tr.line.visible = false;
  }
  for (const p of puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.sp.visible = false; continue; }
    const k = p.life / p.max;
    p.sp.position.x += p.vx * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt;
    p.sp.scale.addScalar(p.grow * dt);
    p.sp.material.opacity = p.fade * Math.min(1, k * 1.6);
  }
  for (let i = smokesFx.length - 1; i >= 0; i--) {
    const s = smokesFx[i];
    s.life -= dt;
    const age = s.max - s.life;
    const aIn = Math.min(1, age / 1.1), aOut = Math.min(1, s.life / 2.2);
    for (const sp of s.group) {
      sp.material.opacity = 0.52 * Math.min(aIn, aOut);
      const target = sp.userData.baseScale * Math.min(1, 0.4 + age / 2.4);
      sp.scale.setScalar(Math.max(sp.scale.x, target));
      sp.position.y += dt * 0.06;
    }
    if (s.life <= 0) {
      for (const sp of s.group) { scene.remove(sp); sp.material.dispose(); }
      smokesFx.splice(i, 1);
    }
  }
  if (flashLife > 0) {
    flashLife -= dt;
    if (flashLife <= 0) { flashSprite.visible = false; flashLight.intensity = 0; }
    else flashLight.intensity *= Math.pow(0.0005, dt / 0.12);
  }
  for (let i = 0; i < SPARKS; i++) {
    if (sparkLife[i] <= 0) continue;
    sparkLife[i] -= dt;
    if (sparkLife[i] <= 0) { sparkPos[i * 3 + 1] = -50; continue; }
    sparkVel[i * 3 + 1] -= 7.5 * dt;
    sparkPos[i * 3] += sparkVel[i * 3] * dt;
    sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
    sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;

  // Charge device states.
  const c = G.charge;
  carriedMesh.visible = !!(c.carrier && c.carrier.alive && !c.planted);
  if (carriedMesh.visible) {
    const f = c.carrier;
    carriedMesh.position.set(
      f.pos.x - Math.sin(f.yaw) * 0.24, f.pos.y + 1.32, f.pos.z - Math.cos(f.yaw) * 0.24);
    carriedMesh.rotation.y = f.yaw;
    carriedMesh.userData.lampMat.emissiveIntensity = 0.6;
  }
  droppedMesh.visible = !!c.droppedAt && !c.planted;
  if (droppedMesh.visible) {
    droppedMesh.position.set(c.droppedAt.x, 0.24, c.droppedAt.z);
    droppedMesh.rotation.z = 0.5;
    droppedMesh.userData.lampMat.emissiveIntensity = (Math.sin(t * 5) > 0) ? 1.6 : 0.1;
  }
  plantedMesh.visible = !!c.planted;
  if (plantedMesh.visible) {
    plantedMesh.position.set(c.plantPos.x, 0.22, c.plantPos.z);
    const urgent = c.fuse < 10 ? 14 : 6;
    plantedMesh.userData.lampMat.emissiveIntensity = (Math.sin(t * urgent) > 0) ? 2.4 : 0.15;
    plantedLight.position.set(c.plantPos.x, 0.7, c.plantPos.z);
    plantedLight.intensity = (Math.sin(t * urgent) > 0) ? 7 : 0;
  } else plantedLight.intensity = 0;

  // Grenade bodies follow the sim.
  for (const g of G.grenades) {
    if (g.mesh) g.mesh.position.set(g.pos.x, g.pos.y, g.pos.z);
  }
}
