// IRONHOLD — the bot fighters. Each bot runs a small brain on a think timer:
// perceive (sight through a view cone with line-of-sight, hearing through the
// shared noise list), decide (advance a lane, hold a post, engage, plant,

import { BOT, TEAM, WEAPONS } from './config.js';
import { G, rng, rngRange } from './state.js';
import { NODES, ADJ, SITE, DEFEND_POSTS } from './world.js';
import { losClear } from './world.js';
import { stepFighter, eyeHeight } from './physics.js';
import { tryFire, currentWeaponId, ensureAmmo, startReload } from './weapons.js';

export function makeBrain(team, index) {
  return {
    state: 'advance',
    path: [], pathI: 0,
    via: -1,
    holdNode: team === TEAM.GARUDA ? DEFEND_POSTS[index % DEFEND_POSTS.length] : -1,
    watchYaw: 0,
    enemy: null, lastSeenPos: null, lastSeenAt: -99, heardAt: -99,
    reactionAt: 0, thinkAt: Math.random() * 0.1,
    burstLeft: 0, burstPauseUntil: 0,
    strafeDir: 1, strafeFlipAt: 0,
    nadeAt: 6 + Math.random() * 14,
    stuckPos: null, stuckAt: 0,
    lane: index,
  };
}

const WATCH_YAW = { 27: 0.2, 25: 0, 18: -Math.PI / 2, 5: -Math.PI / 2, 21: Math.PI, 26: 0.6, 28: -0.7, 29: 0.9 };

function nearestNode(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < NODES.length; i++) {
    const dx = NODES[i].x - x, dz = NODES[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// A* over the waypoint graph; returns the node list from a to b inclusive.
function pathfind(a, b) {
  if (a === b) return [a];
  const open = [a];
  const came = new Map([[a, -1]]);
  const cost = new Map([[a, 0]]);
  const h = (n) => Math.hypot(NODES[n].x - NODES[b].x, NODES[n].z - NODES[b].z);
  const fScore = new Map([[a, h(a)]]);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if ((fScore.get(open[i]) ?? 1e9) < (fScore.get(open[bi]) ?? 1e9)) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === b) {
      const path = [cur];
      let n = cur;
      while (came.get(n) !== -1) { n = came.get(n); path.unshift(n); }
      return path;
    }
    for (const nb of ADJ[cur]) {
      const c = (cost.get(cur) ?? 1e9) + Math.hypot(NODES[nb].x - NODES[cur].x, NODES[nb].z - NODES[cur].z);
      if (c < (cost.get(nb) ?? 1e9)) {
        cost.set(nb, c); came.set(nb, cur); fScore.set(nb, c + h(nb));
        if (!open.includes(nb)) open.push(nb);
      }
    }
  }
  return [a];
}

function setPathTo(f, nodeIdx) {
  const from = nearestNode(f.pos.x, f.pos.z);
  f.brain.path = pathfind(from, nodeIdx);
  f.brain.pathI = 0;
}

// Steer toward a point; returns the remaining distance.
function steer(f, tx, tz, speed, dt, faceTarget = true) {
  const dx = tx - f.pos.x, dz = tz - f.pos.z;
  const dist = Math.hypot(dx, dz);
  if (faceTarget && dist > 0.4) {
    const want = Math.atan2(dx, dz);
    f.yaw = turnToward(f.yaw, want, 7 * dt);
  }
  stepFighter(f, dt, dx, dz, speed, false);
  return dist;
}

export function turnToward(cur, want, maxStep) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return want;
  return cur + Math.sign(d) * maxStep;
}

function canSee(f, e, now) {
  const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > BOT.seeRange) return false;
  if (dist > 2.2) {
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    if ((dx * fx + dz * fz) / dist < BOT.seeFovCos) return false;
  }
  return losClear(f.pos.x, eyeHeight(f), f.pos.z,
    e.pos.x, e.pos.y + 1.3, e.pos.z, G.smokes);
}

function perceive(f, now) {
  const b = f.brain;
  let seen = null, seenDist = Infinity;
  for (const e of G.fighters) {
    if (!e.alive || e.team === f.team) continue;
    if (canSee(f, e, now)) {
      const d = Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z);
      if (d < seenDist) { seenDist = d; seen = e; }
    }
  }
  if (seen) {
    if (b.enemy !== seen) b.reactionAt = now + rngRange(BOT.reactionMin, BOT.reactionMax);
    b.enemy = seen;
    b.lastSeenPos = { x: seen.pos.x, z: seen.pos.z };
    b.lastSeenAt = now;
  } else if (b.enemy && (!b.enemy.alive || now - b.lastSeenAt > 0.4)) {
    b.enemy = null;
  }
  // Hearing: the freshest loud noise inside earshot becomes a look point.
  for (let i = G.noises.length - 1; i >= 0; i--) {
    const n = G.noises[i];
    if (n.t <= b.heardAt) break;
    if (Math.hypot(n.x - f.pos.x, n.z - f.pos.z) < Math.min(BOT.hearRange, n.radius + 8)) {
      b.heardAt = n.t;
      if (!b.enemy) b.lastSeenPos = { x: n.x, z: n.z };
      break;
    }
  }
}

function aimPoint(f, e, now) {
  // Chest mostly, head sometimes; error shrinks the longer the target is
  const tracked = Math.min(1, (now - f.brain.lastSeenAt + 0.45) / 0.9);
  const err = BOT.aimErrorDeg * (Math.PI / 180) * (1.25 - tracked * 0.55)
    * (1 + Math.min(1, e.speed2d / 5) * 0.7);
  const dist = Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z);
  const off = () => (rng() + rng() + rng() - 1.5) / 1.5 * err * dist;
  const head = rng() < 0.22;
  return {
    x: e.pos.x + off(),
    y: e.pos.y + (head ? 1.52 : 1.22) + off() * 0.5,
    z: e.pos.z + off(),
  };
}

function engage(f, now, dt) {
  const b = f.brain, e = b.enemy;
  const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z;
  const dist = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(dx, dz);
  f.yaw = turnToward(f.yaw, wantYaw, 8 * dt);
  const aim = aimPoint(f, e, now);
  const eyeY = eyeHeight(f);
  f.pitch = Math.atan2(aim.y - eyeY, Math.max(0.1, dist)) * 0.9;

  // Movement in a fight: strafe across the sightline, close or open range.
  if (now > b.strafeFlipAt) { b.strafeDir = rng() < 0.5 ? -1 : 1; b.strafeFlipAt = now + rngRange(0.6, 1.3); }
  const px = Math.cos(f.yaw) * b.strafeDir, pz = -Math.sin(f.yaw) * b.strafeDir;
  let mx = px, mz = pz;
  if (dist > 24) { mx += Math.sin(f.yaw) * 0.8; mz += Math.cos(f.yaw) * 0.8; }
  if (dist < 6) { mx -= Math.sin(f.yaw) * 0.5; mz -= Math.cos(f.yaw) * 0.5; }
  f.crouch = dist > 20 && f.speed2d < 0.5 && rng() < 0.01;
  stepFighter(f, dt, mx, mz, dist > 24 ? 4.5 : 3.1, false);

  // Fire control: bursts with pauses, only after the reaction delay and with
  const wid = currentWeaponId(f);
  if (!wid || wid === 'golok') return;
  const ammo = ensureAmmo(f, wid);
  if (ammo.mag <= 0) { startReload(f, now); return; }
  if (now < b.reactionAt || now < (f.drawUntil || 0)) return;
  if (!losClear(f.pos.x, eyeY, f.pos.z, e.pos.x, e.pos.y + 1.25, e.pos.z, G.smokes)) return;
  if (now < b.burstPauseUntil) return;
  if (b.burstLeft <= 0) {
    const w = WEAPONS[wid];
    b.burstLeft = w.rpm > 300 ? Math.floor(rngRange(BOT.burstMin, BOT.burstMax + 1)) : 1;
  }
  const adx = aim.x - f.pos.x, ady = aim.y - eyeY, adz = aim.z - f.pos.z;
  const ad = Math.hypot(adx, ady, adz) || 1;
  const res = tryFire(f, f.pos.x, eyeY, f.pos.z, adx / ad, ady / ad, adz / ad, now);
  if (res === 'fired') {
    b.burstLeft--;
    if (b.burstLeft <= 0) b.burstPauseUntil = now + BOT.burstPause * rngRange(0.7, 1.4);
  }

  // An occasional grenade toward the target's feet breaks a held angle.
  if (now > b.nadeAt && dist > 8 && dist < 22) {
    b.nadeAt = now + rngRange(9, 20);
    const kind = f.grenades.pecah > 0 ? 'pecah' : f.grenades.kilat > 0 ? 'kilat' : null;
    if (kind && G.onBotGrenade) G.onBotGrenade(f, kind, e.pos);
  }
}

// Decide the bot's current objective node, by team and charge state.
function objectiveNode(f) {
  const b = f.brain, c = G.charge;
  if (f.team === TEAM.KOMODO) {
    if (c.planted) return [26, 27, 28, 29][f.id % 4];  // guard the charge
    if (c.carrier === f) return 27;  // carrier: to the pad
    if (c.droppedAt && !c.carrier) {
      // Only the nearest attacker fetches it; the rest press on.
      let nearest = null, nd = Infinity;
      for (const o of G.fighters) {
        if (o.team !== TEAM.KOMODO || !o.alive) continue;
        const d = Math.hypot(o.pos.x - c.droppedAt.x, o.pos.z - c.droppedAt.z);
        if (d < nd) { nd = d; nearest = o; }
      }
      if (nearest === f) return nearestNode(c.droppedAt.x, c.droppedAt.z);
    }
    if (b.via >= 0) {
      const v = NODES[b.via];
      if (Math.hypot(f.pos.x - v.x, f.pos.z - v.z) < 1.6) b.via = -1;
      else return b.via;
    }
    return 26;
  }
  // GARUDA
  if (c.planted) return 26 + (f.id % 4);  // converge on the site
  return b.holdNode;
}

function think(f, now) {
  const b = f.brain;
  perceive(f, now);
  if (b.enemy) { b.state = 'engage'; return; }
  if (f.team === TEAM.KOMODO && G.charge.carrier === f
    && f.pos.x > SITE.x0 && f.pos.x < SITE.x1 && f.pos.z > SITE.z0 && f.pos.z < SITE.z1) {
    b.state = 'plant';
    return;
  }
  if (f.team === TEAM.GARUDA && G.charge.planted) {
    // The closest living defender goes hands-on; the rest cover the pad.
    let nearest = null, nd = Infinity;
    for (const o of G.fighters) {
      if (o.team !== TEAM.GARUDA || !o.alive) continue;
      const d = Math.hypot(o.pos.x - G.charge.plantPos.x, o.pos.z - G.charge.plantPos.z);
      if (d < nd) { nd = d; nearest = o; }
    }
    if (nearest === f && nd < 2.4) { b.state = 'defuse'; return; }
  }
  const heardFresh = b.lastSeenPos && now - Math.max(b.lastSeenAt, b.heardAt) < 3.5 && !b.enemy;
  b.state = heardFresh ? 'investigate' : (f.team === TEAM.GARUDA && !G.charge.planted ? 'hold' : 'advance');
  // (Re)path when the objective node changed or the path ran out.
  const goal = b.state === 'investigate' ? nearestNode(b.lastSeenPos.x, b.lastSeenPos.z) : objectiveNode(f);
  if (b.goalNode !== goal || b.pathI >= b.path.length) {
    b.goalNode = goal;
    setPathTo(f, goal);
  }
}

export function updateBot(f, dt, now) {
  const b = f.brain;
  if (!f.alive) return;
  f.channel = null;
  if (now >= b.thinkAt) { b.thinkAt = now + BOT.thinkInterval; think(f, now); }

  if (b.state === 'engage' && b.enemy && b.enemy.alive) { engage(f, now, dt); return; }

  if (b.state === 'plant') {
    f.crouch = true;
    f.yaw = turnToward(f.yaw, Math.PI, 5 * dt);  // face the crane core
    stepFighter(f, dt, 0, 0, 0, false);
    f.channel = 'plant';
    return;
  }
  if (b.state === 'defuse') {
    f.crouch = true;
    const p = G.charge.plantPos;
    f.yaw = turnToward(f.yaw, Math.atan2(p.x - f.pos.x, p.z - f.pos.z), 6 * dt);
    stepFighter(f, dt, 0, 0, 0, false);
    f.channel = 'defuse';
    return;
  }

  // Follow the path; the last leg steers at the goal point itself.
  f.crouch = false;
  const path = b.path;
  if (path.length && b.pathI < path.length) {
    const node = NODES[path[b.pathI]];
    const isLast = b.pathI === path.length - 1;
    const d = steer(f, node.x, node.z, b.state === 'hold' ? 4.4 : 5.4, dt);
    if (d < (isLast ? 0.55 : 0.95)) b.pathI++;
    // Stuck detection: barely moved while trying to — skip a node ahead.
    if (now - b.stuckAt > 1.6) {
      if (b.stuckPos && Math.hypot(f.pos.x - b.stuckPos.x, f.pos.z - b.stuckPos.z) < 0.35 && f.speed2d < 0.4) {
        b.pathI = Math.min(path.length - 1, b.pathI + 1);
      }
      b.stuckPos = { x: f.pos.x, z: f.pos.z };
      b.stuckAt = now;
    }
  } else if (b.state === 'hold') {
    // On post: settle, watch the lane, shift weight now and then.
    const post = NODES[b.holdNode];
    if (Math.hypot(f.pos.x - post.x, f.pos.z - post.z) > 0.8) steer(f, post.x, post.z, 3.6, dt);
    else {
      stepFighter(f, dt, 0, 0, 0, false);
      f.yaw = turnToward(f.yaw, (WATCH_YAW[b.holdNode] ?? 0) + Math.sin(now * 0.24 + f.id * 2.1) * 0.35, 2.4 * dt);
      f.crouch = f.id % 3 === 0;
    }
  } else {
    stepFighter(f, dt, 0, 0, 0, false);
  }
}

// The bot buy policy, run by the sim at each round start: tiered by money,
export function botBuy(f) {
  const m = f.money;
  const buy = (fn) => fn();
  if (!f.weapons.primary) {
    if (m >= 3900) buy(() => { f.weapons.primary = 'elang'; f.money -= 2900; });
    else if (m >= 3150) buy(() => { f.weapons.primary = 'banteng'; f.money -= 2500; });
    else if (m >= 1750) buy(() => { f.weapons.primary = rng() < 0.6 ? 'rusa' : 'badak'; f.money -= f.weapons.primary === 'rusa' ? 1000 : 1100; });
  }
  if (f.armor === 0 && f.money >= 1650) { f.armor = 2; f.armorHp = 100; f.money -= 1000; }
  else if (f.armor === 0 && f.money >= 800) { f.armor = 1; f.armorHp = 100; f.money -= 650; }
  else if (f.armor > 0 && f.armorHp < 60 && f.money >= 1000) { f.armorHp = 100; f.money -= f.armor === 2 ? 1000 : 650; }
  if (f.team === TEAM.GARUDA && !f.hasKit && f.money >= 500 && rng() < 0.55) { f.hasKit = true; f.money -= 200; }
  if (f.money >= 700) {
    if (rng() < 0.5 && f.grenades.pecah === 0) { f.grenades.pecah = 1; f.money -= 300; }
    else if (f.grenades.kilat === 0) { f.grenades.kilat = 1; f.money -= 200; }
  }
  f.current = f.weapons.primary ? 'primary' : 'sidearm';
}
