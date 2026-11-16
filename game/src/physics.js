// IRONHOLD — movement physics shared by the player and every bot: acceleration
// and friction on the ground, gravity, stepping onto low ledges, and circle vs
// AABB collision against the world's colliders. One implementation, so a bot

import { colliders, groundHeightAt } from './world.js';
import { PLAYER } from './config.js';

// Integrate one fighter for dt seconds. wishX/wishZ is the desired horizontal
// direction (not normalised by the caller), speed the desired top speed.
export function stepFighter(f, dt, wishX, wishZ, speed, jump) {
  const p = f.pos, v = f.vel;
  const onGround = f.grounded;

  // Horizontal: accelerate toward the wish velocity, with ground friction
  const wishLen = Math.hypot(wishX, wishZ);
  let tx = 0, tz = 0;
  if (wishLen > 0.001) { tx = (wishX / wishLen) * speed; tz = (wishZ / wishLen) * speed; }
  const accel = onGround ? PLAYER.accel : PLAYER.accel * 0.18;
  const dx = tx - v.x, dz = tz - v.z;
  const dLen = Math.hypot(dx, dz);
  const maxDelta = (wishLen > 0.001 ? accel : PLAYER.friction * Math.max(1, Math.hypot(v.x, v.z))) * dt;
  if (dLen > 0.0001) {
    const s = Math.min(1, maxDelta / dLen);
    v.x += dx * s; v.z += dz * s;
  }

  if (jump && onGround) { v.y = PLAYER.jumpSpeed; f.grounded = false; }
  v.y -= PLAYER.gravity * dt;

  p.x += v.x * dt;
  p.z += v.z * dt;
  p.y += v.y * dt;

  // Horizontal push-out: any collider rising well above the feet and reaching
  const height = f.crouch ? PLAYER.crouchHeight : PLAYER.height;
  for (const c of colliders) {
    if (c.y1 <= p.y + 0.28 || c.y0 >= p.y + height - 0.15) continue;
    const nx = Math.max(c.x0, Math.min(p.x, c.x1));
    const nz = Math.max(c.z0, Math.min(p.z, c.z1));
    let ox = p.x - nx, oz = p.z - nz;
    const d2 = ox * ox + oz * oz;
    if (d2 > PLAYER.radius * PLAYER.radius) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = nx + (ox / d) * PLAYER.radius;
      p.z = nz + (oz / d) * PLAYER.radius;
    } else {
      // Centre inside the box: leave by the shallowest face.
      const left = p.x - c.x0, right = c.x1 - p.x, back = p.z - c.z0, front = c.z1 - p.z;
      const m = Math.min(left, right, back, front);
      if (m === left) p.x = c.x0 - PLAYER.radius;
      else if (m === right) p.x = c.x1 + PLAYER.radius;
      else if (m === back) p.z = c.z0 - PLAYER.radius;
      else p.z = c.z1 + PLAYER.radius;
    }
  }

  // Ground: snap down to the highest steppable floor; walking off a ledge
  const ground = groundHeightAt(p.x, p.z, p.y);
  if (p.y <= ground) {
    p.y = ground;
    v.y = 0;
    f.grounded = true;
  } else if (p.y - ground > 0.02) {
    f.grounded = false;
  } else {
    f.grounded = true;
  }
  f.speed2d = Math.hypot(v.x, v.z);
}

// Eye height above the feet for a fighter (player camera and bot sight origin).
export function eyeHeight(f) {
  return f.pos.y + (f.crouch ? PLAYER.crouchEye : PLAYER.eye);
}
