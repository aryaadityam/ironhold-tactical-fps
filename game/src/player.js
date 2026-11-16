// IRONHOLD — the human player: pointer-lock mouse look, WASD movement with
// sprint and crouch, weapon slots and the first-person viewmodel rig (bob,
// sway, recoil kick, reload dip, draw raise). Input is collected here and

import * as THREE from 'three';
import { PLAYER, WEAPONS } from './config.js';
import { G, PHASE } from './state.js';
import { stepFighter, eyeHeight } from './physics.js';
import { buildViewmodel, currentWeaponId, startReload } from './weapons.js';
import { sfxStep, sfxJump, initAudio, startAmbient } from './audio.js';

export const input = {
  keys: new Set(),
  pressed: new Set(),       // codes hit this frame (cleared by main each frame)
  mouseDX: 0, mouseDY: 0,
  firing: false, clicked: false, zooming: false,
  locked: false,
};

let camera = null, rig = null, rigParts = null, currentVmId = null;
const vmCache = new Map();
let bobPhase = 0, stepAcc = 0, wasGrounded = true, drawT = 1, swayX = 0, swayY = 0;

export function initPlayer(cam, canvas) {
  camera = cam;
  rig = new THREE.Group();
  rig.position.set(0.23, -0.21, -0.45);
  camera.add(rig);
  canvas.addEventListener('click', () => {
    initAudio(); startAmbient();
    if (!input.locked && !G.shotMode) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.mouseDX += e.movementX || 0;
    input.mouseDY += e.movementY || 0;
  });
  document.addEventListener('mousedown', (e) => {
    if (!input.locked && !G.shotMode) return;
    if (e.button === 0) { input.firing = true; input.clicked = true; }
    if (e.button === 2) input.zooming = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
    if (e.button === 2) input.zooming = false;
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  document.addEventListener('keyup', (e) => input.keys.delete(e.code));
  document.addEventListener('wheel', (e) => {
    if (input.locked) input.pressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
  }, { passive: true });
}

export function playerWeaponId(f) { return currentWeaponId(f); }

// Switch the held slot; returns false when the slot is empty or unchanged.
export function switchSlot(f, slot, now) {
  if (slot === 'grenade') {
    if (f.grenades.pecah + f.grenades.kilat + f.grenades.asap <= 0) return false;
    if (f.current !== 'grenade') {
      f.current = 'grenade';
      // Pick the first grenade kind actually carried.
      f.grenadeKind = f.grenades.pecah ? 'pecah' : f.grenades.kilat ? 'kilat' : 'asap';
    } else {
      const kinds = ['pecah', 'kilat', 'asap'].filter((k) => f.grenades[k] > 0);
      const i = kinds.indexOf(f.grenadeKind);
      f.grenadeKind = kinds[(i + 1) % kinds.length];
    }
  } else {
    if (!f.weapons[slot] || f.current === slot) return false;
    f.current = slot;
  }
  f.reloadUntil = 0;
  f.drawUntil = now + 0.32;
  drawT = 0;
  return true;
}

function cycleSlot(f, dir, now) {
  const order = ['primary', 'sidearm', 'melee', 'grenade']
    .filter((s) => s === 'grenade'
      ? (f.grenades.pecah + f.grenades.kilat + f.grenades.asap) > 0
      : !!f.weapons[s]);
  if (!order.length) return;
  let i = order.indexOf(f.current);
  i = (i + dir + order.length) % order.length;
  switchSlot(f, order[i], now);
}

// The per-step player update: look, move, act. Called from the fixed-step loop.
export function updatePlayer(f, dt, now) {
  const sens = 0.0021 * (input.zooming && zoomFov(f) < 40 ? 0.45 : 1);
  f.yaw -= input.mouseDX * sens;
  f.pitch -= input.mouseDY * sens;
  f.pitch = Math.max(-1.45, Math.min(1.45, f.pitch));
  input.mouseDX = 0; input.mouseDY = 0;

  const frozen = G.phase === PHASE.BUY || G.phase === PHASE.MATCHEND || !f.alive;
  const k = input.keys;
  let wx = 0, wz = 0;
  if (!frozen) {
    const sin = Math.sin(f.yaw), cos = Math.cos(f.yaw);
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    wx = sin * fwd + cos * str;
    wz = cos * fwd - sin * str;
  }
  f.crouch = !frozen && (k.has('ControlLeft') || k.has('KeyC'));
  const sprint = k.has('ShiftLeft') && !f.crouch && !input.zooming;
  const wid = currentWeaponId(f);
  const wSpeed = wid ? WEAPONS[wid].speed : 1;
  const speed = (f.crouch ? PLAYER.crouchSpeed : sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * wSpeed;
  const jump = !frozen && k.has('Space');
  if (jump && f.grounded) sfxJump();
  stepFighter(f, dt, wx, wz, speed, jump);

  // Footsteps: distance-based, and sprinting is audible to nearby bots.
  if (f.grounded && f.speed2d > 0.6) {
    stepAcc += f.speed2d * dt;
    const stride = sprint ? 2.9 : 2.3;
    if (stepAcc > stride) {
      stepAcc = 0;
      sfxStep(sprint);
      if (sprint) G.noises.push({ x: f.pos.x, z: f.pos.z, radius: 13, t: G.time });
    }
  }
  if (f.grounded && !wasGrounded) sfxStep(true);
  wasGrounded = f.grounded;

  // Slots, reload, grenade kind cycling.
  if (!frozen) {
    if (input.pressed.has('Digit1')) switchSlot(f, 'primary', now);
    if (input.pressed.has('Digit2')) switchSlot(f, 'sidearm', now);
    if (input.pressed.has('Digit3')) switchSlot(f, 'melee', now);
    if (input.pressed.has('Digit4')) switchSlot(f, 'grenade', now);
    if (input.pressed.has('WheelDown')) cycleSlot(f, 1, now);
    if (input.pressed.has('WheelUp')) cycleSlot(f, -1, now);
    if (input.pressed.has('KeyR')) startReload(f, now);
    if (input.pressed.has('KeyG') && f.current === 'grenade') switchSlot(f, 'grenade', now);
  }

  // Firing and throwing are resolved by the simulation, which reads these.
  f.wantFire = !frozen && (input.firing || input.clicked) && now >= (f.drawUntil || 0);
  f.wantThrow = !frozen && input.clicked && f.current === 'grenade';
  input.clicked = false;
}

export function zoomFov(f) {
  const wid = currentWeaponId(f);
  if (!wid || !input.zooming) return 74;
  const z = WEAPONS[wid].zoom;
  return z > 1 ? 74 / z : 74;
}

// Pose the camera and the viewmodel from the fighter record, once per frame.
const _look = new THREE.Vector3();
export function poseCamera(f, dt) {
  const eye = eyeHeight(f);
  bobPhase += dt * (f.grounded ? f.speed2d * 1.9 : 0);
  const bobY = Math.sin(bobPhase * 2) * 0.016 * Math.min(1, f.speed2d / 4);
  const bobX = Math.cos(bobPhase) * 0.008 * Math.min(1, f.speed2d / 4);
  camera.position.set(f.pos.x + bobX * Math.cos(f.yaw), f.pos.y + eye + bobY, f.pos.z - bobX * Math.sin(f.yaw));
  const pitch = f.pitch + (f.punch || 0);
  _look.set(
    camera.position.x + Math.sin(f.yaw) * Math.cos(pitch),
    camera.position.y + Math.sin(pitch),
    camera.position.z + Math.cos(f.yaw) * Math.cos(pitch),
  );
  camera.lookAt(_look);
  const targetFov = G.shotMode ? 62 : zoomFov(f);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 11);
  camera.updateProjectionMatrix();

  // Viewmodel: swap on weapon change, then bob, sway, kick and reload dip.
  const id = f.current === 'grenade' ? f.grenadeKind : currentWeaponId(f);
  if (id !== currentVmId) {
    while (rig.children.length) rig.remove(rig.children[0]);
    if (id) {
      if (!vmCache.has(id)) vmCache.set(id, buildViewmodel(id));
      rigParts = vmCache.get(id);
      rig.add(rigParts);
      f.viewMuzzle = rigParts.userData.muzzle;
    }
    currentVmId = id;
    drawT = 0;
  }
  drawT = Math.min(1, drawT + dt / 0.3);
  const scoped = input.zooming && (WEAPONS[currentWeaponId(f)]?.zoom ?? 1) >= 2;
  rig.visible = f.alive && !scoped;
  if (rigParts) {
    swayX += ((input.mouseDX || 0) * -0.0004 - swayX) * Math.min(1, dt * 10);
    const kick = (f.punch || 0) * 1.4;
    let rx = 0, ry = -0.35 * (1 - drawT), rz = 0.06 * (1 - drawT);
    if (f.reloadUntil && f.reloadUntil > performance.now() / 1000) {
      const w = WEAPONS[currentWeaponId(f)];
      const total = w ? w.reload : 1;
      const left = f.reloadUntil - performance.now() / 1000;
      const p = 1 - left / total;
      rx = Math.sin(Math.min(1, p) * Math.PI) * 0.55;
      if (rigParts.userData.magMesh) {
        rigParts.userData.magMesh.position.y = -0.13 - Math.sin(Math.min(1, Math.max(0, (p - 0.15) / 0.5)) * Math.PI) * 0.13;
      }
    }
    rig.position.set(
      0.23 + swayX + Math.cos(bobPhase) * 0.006 * Math.min(1, f.speed2d / 4),
      -0.21 + ry + Math.abs(Math.sin(bobPhase * 2)) * 0.008 * Math.min(1, f.speed2d / 4) - kick * 0.35,
      -0.45 + kick * 0.6,
    );
    rig.rotation.set(rx + kick * 0.8, swayX * 2.2, rz);
  }
}
