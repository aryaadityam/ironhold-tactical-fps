// IRONHOLD — the match simulation, stepped at a fixed 60 Hz apart from
// rendering. Owns the phase machine (buy, live, planted, end, match end), the
// round clock, the charge (plant, defuse, detonation), grenade physics and

import { MATCH, REWARD, TEAM, WEAPONS } from './config.js';
import { G, PHASE, resetMatch, resetRound, aliveCount, rng } from './state.js';
import { SPAWNS, SITE, ATTACK_ROUTES, groundHeightAt, losClear } from './world.js';
import { updateBot, botBuy, makeBrain } from './bots.js';
import { updatePlayer, switchSlot, input } from './player.js';
import { tryFire, updateWeapons, ensureAmmo, applyDamage } from './weapons.js';
import { setFighterGun } from './characters.js';
import { eyeHeight } from './physics.js';
import { explosionFx, attachGrenadeMesh, detachGrenadeMesh, spawnSmokeFx, spawnTracer, muzzleFlash } from './fx.js';
import { sfxExplosion, sfxFlashbang, sfxBeep, sfxWire, sfxSting, sfxThrow } from './audio.js';

let lastBeepSecond = -1;

// Bots ask the sim to throw their grenades through this hook (set here so
export function initSim() {
  G.onBotGrenade = (f, kind, targetPos) => throwGrenade(f, kind, targetPos);
}

export function startMatch() {
  resetMatch();
  G.lossStreak = { [TEAM.GARUDA]: 0, [TEAM.KOMODO]: 0 };
  startRound();
}

export function startRound() {
  resetRound();
  const byTeam = { [TEAM.GARUDA]: 0, [TEAM.KOMODO]: 0 };
  for (const f of G.fighters) {
    const sp = SPAWNS[f.team][byTeam[f.team]++];
    f.pos.x = sp.x; f.pos.z = sp.z; f.pos.y = 0;
    f.yaw = sp.yaw; f.pitch = 0;
    f.brain = f.isPlayer ? null : makeBrain(f.team, byTeam[f.team] - 1);
    ensureAmmo(f, 'kijang');
    if (f.weapons.primary) ensureAmmo(f, f.weapons.primary);
  }
  // Attackers: one carries the charge, each takes a lane via node.
  const attackers = G.fighters.filter((f) => f.team === TEAM.KOMODO);
  const carrier = attackers[Math.floor(rng() * attackers.length)];
  G.charge.carrier = carrier;
  attackers.forEach((f, i) => {
    const route = ATTACK_ROUTES[i % ATTACK_ROUTES.length];
    f.brain.via = route[Math.floor(route.length / 2)];
  });
  for (const f of G.fighters) {
    if (f.isPlayer) continue;
    botBuy(f);
    setFighterGun(f, f.weapons[f.current]);
  }
  G.phase = PHASE.BUY;
  G.phaseT = MATCH.buySeconds;
  G.roundTime = MATCH.roundSeconds;
  lastBeepSecond = -1;
}

function endRound(winner, reason) {
  G.phase = PHASE.END;
  G.phaseT = MATCH.endSeconds;
  G.winner = winner;
  G.lastRound = { winner, reason };
  G.score[winner]++;
  const loser = winner === TEAM.GARUDA ? TEAM.KOMODO : TEAM.GARUDA;
  const winPay = reason === 'elimination' ? REWARD.winElimination
    : reason === 'timeout' ? REWARD.winTimeout : REWARD.winObjective;
  for (const f of G.fighters) {
    if (f.team === winner) f.money = Math.min(MATCH.maxMoney, f.money + winPay);
    else {
      const bonus = Math.min(REWARD.lossBase + REWARD.lossStep * G.lossStreak[loser], REWARD.lossMax);
      f.money = Math.min(MATCH.maxMoney, f.money + bonus);
    }
  }
  G.lossStreak[loser]++;
  G.lossStreak[winner] = 0;
  sfxSting(G.player.team === winner);
}

function detonate() {
  const p = G.charge.plantPos;
  explosionFx(p.x, 1, p.z, true);
  sfxExplosion(true);
  for (const f of G.fighters) {
    if (!f.alive) continue;
    const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
    if (d < 11) applyDamage(f, 240 * (1 - d / 11) + 30, false, null);
  }
  endRound(TEAM.KOMODO, 'detonation');
}

// grenades

export function throwGrenade(f, kind, targetPos) {
  if (f.grenades[kind] <= 0) return;
  f.grenades[kind]--;
  const eyeY = f.pos.y + eyeHeight(f);
  let dx, dy, dz;
  if (targetPos) {
    const dist = Math.hypot(targetPos.x - f.pos.x, targetPos.z - f.pos.z);
    dx = (targetPos.x - f.pos.x) / dist; dz = (targetPos.z - f.pos.z) / dist;
    dy = 0.42 + dist * 0.012;
  } else {
    const cp = Math.cos(f.pitch + 0.12);
    dx = Math.sin(f.yaw) * cp; dz = Math.cos(f.yaw) * cp; dy = Math.sin(f.pitch + 0.12);
  }
  const g = {
    kind, owner: f,
    pos: { x: f.pos.x + dx * 0.4, y: eyeY - 0.05, z: f.pos.z + dz * 0.4 },
    vel: { x: dx * 14.5, y: dy * 9.5 + 1.6, z: dz * 14.5 },
    fuse: kind === 'pecah' ? 1.6 : kind === 'kilat' ? 1.35 : 0.85,
    mesh: null, bounced: false,
  };
  attachGrenadeMesh(g);
  G.grenades.push(g);
  sfxThrow();
  if (f.isPlayer && f.current === 'grenade'
    && f.grenades.pecah + f.grenades.kilat + f.grenades.asap === 0) {
    switchSlot(f, f.weapons.primary ? 'primary' : 'sidearm', G.time);
  }
}

function resolveGrenade(g) {
  const p = g.pos;
  if (g.kind === 'asap') {
    G.smokes.push({ x: p.x, y: p.y, z: p.z, r: 3.4, until: G.time + 14 });
    spawnSmokeFx(p.x, p.y, p.z, 3.4, 14);
    return;
  }
  if (g.kind === 'pecah') {
    explosionFx(p.x, p.y, p.z, false);
    sfxExplosion(false);
    for (const f of G.fighters) {
      if (!f.alive || f === g.owner) continue;
      const d = Math.hypot(f.pos.x - p.x, f.pos.y + 1 - p.y, f.pos.z - p.z);
      if (d > 5.2) continue;
      if (!losClear(p.x, p.y, p.z, f.pos.x, f.pos.y + 1.1, f.pos.z, [])) continue;
      applyDamage(f, 92 * Math.pow(1 - d / 5.2, 1.4) + 4, false, g.owner);
    }
    G.noises.push({ x: p.x, z: p.z, radius: 30, t: G.time });
    return;
  }
  // flash: blindness by range, LOS and facing.
  sfxFlashbang();
  for (const f of G.fighters) {
    if (!f.alive || f === g.owner) continue;
    const dx = p.x - f.pos.x, dz = p.z - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 19) continue;
    if (!losClear(f.pos.x, f.pos.y + 1.4, f.pos.z, p.x, p.y, p.z, [])) continue;
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    const facing = (dx * fx + dz * fz) / (d || 1);
    const look = facing > 0.5 ? 1 : facing > -0.2 ? 0.45 : 0.15;
    const dur = (4.4 - 2.4 * (d / 19)) * look;
    if (dur > 0.25) f.flashUntil = Math.max(f.flashUntil, G.time + dur);
  }
}

function stepGrenades(dt) {
  for (let i = G.grenades.length - 1; i >= 0; i--) {
    const g = G.grenades[i];
    g.fuse -= dt;
    g.vel.y -= 12.5 * dt;
    g.pos.x += g.vel.x * dt; g.pos.y += g.vel.y * dt; g.pos.z += g.vel.z * dt;
    // Ground and rooftop bounce (groundHeightAt sees the collider tops).
    const floor = groundHeightAt(g.pos.x, g.pos.z, g.pos.y + 0.3, 0.6) + 0.06;
    if (g.pos.y < floor) {
      g.pos.y = floor;
      if (Math.abs(g.vel.y) > 1.2) { g.vel.y *= -0.38; g.bounced = true; }
      else g.vel.y = 0;
      g.vel.x *= 0.68; g.vel.z *= 0.68;
      if (g.kind === 'asap') g.fuse = Math.min(g.fuse, 0.05);
    }
    if (g.fuse <= 0) {
      resolveGrenade(g);
      detachGrenadeMesh(g);
      G.grenades.splice(i, 1);
    }
  }
}

// the step

export function step(dt) {
  G.time += dt;
  const now = G.time;
  if (G.shotMode) { stageShotFx(now); return; }

  const player = G.player;
  if (player && player.alive && G.phase !== PHASE.MATCHEND) updatePlayer(player, dt, now);
  else if (player) { player.wantFire = false; player.wantThrow = false; }

  // Phase clocks.
  if (G.phase === PHASE.BUY) {
    G.phaseT -= dt;
    if (G.phaseT <= 0) { G.phase = PHASE.LIVE; }
  } else if (G.phase === PHASE.LIVE) {
    G.roundTime -= dt;
    if (G.roundTime <= 0) { G.roundTime = 0; endRound(TEAM.GARUDA, 'timeout'); }
  } else if (G.phase === PHASE.PLANTED) {
    G.charge.fuse -= dt;
    const sec = Math.ceil(G.charge.fuse);
    if (G.charge.fuse <= 10 && sec !== lastBeepSecond) { lastBeepSecond = sec; sfxBeep(true); }
    if (G.charge.fuse <= 0) detonate();
  } else if (G.phase === PHASE.END) {
    G.phaseT -= dt;
    if (G.phaseT <= 0) {
      if (G.score[TEAM.GARUDA] >= MATCH.winRounds || G.score[TEAM.KOMODO] >= MATCH.winRounds || G.round >= MATCH.maxRounds) {
        G.phase = PHASE.MATCHEND;
        G.matchWinner = G.score[TEAM.GARUDA] > G.score[TEAM.KOMODO] ? TEAM.GARUDA : TEAM.KOMODO;
      } else {
        G.round++;
        startRound();
      }
    }
  }

  const playing = G.phase === PHASE.LIVE || G.phase === PHASE.PLANTED;

  // The human's trigger and hands.
  if (player && player.alive && playing) {
    if (player.wantThrow && player.current === 'grenade') {
      throwGrenade(player, player.grenadeKind, null);
    } else if (player.wantFire && player.current !== 'grenade') {
      const wid = player.weapons[player.current];
      const edge = !player.prevFireHeld;
      if (wid && (WEAPONS[wid].auto || edge)) {
        const eyeY = player.pos.y + eyeHeight(player);
        const cp = Math.cos(player.pitch);
        tryFire(player, player.pos.x, eyeY, player.pos.z,
          Math.sin(player.yaw) * cp, Math.sin(player.pitch), Math.cos(player.yaw) * cp, now);
      }
    }
    // Defuse by hand.
    player.channel = null;
    if (G.charge.planted && Math.hypot(player.pos.x - G.charge.plantPos.x, player.pos.z - G.charge.plantPos.z) < 2.3
      && input.keys.has('KeyE')) player.channel = 'defuse';
  }
  if (player) player.prevFireHeld = !!player.wantFire;

  // Bots act outside the buy freeze.
  if (G.phase !== PHASE.BUY && G.phase !== PHASE.MATCHEND) {
    for (const f of G.fighters) if (!f.isPlayer) updateBot(f, dt, now);
  }

  // Charge: pickup, plant and defuse channels.
  stepCharge(dt, now);

  // Weapon upkeep, grenades, transient lists.
  for (const f of G.fighters) updateWeapons(f, now, dt);
  stepGrenades(dt);
  G.smokes = G.smokes.filter((s) => s.until > now);
  if (G.noises.length && now - G.noises[0].t > 2) G.noises = G.noises.filter((n) => now - n.t < 2);

  // Deaths: rewards, killfeed, charge drops, round end by elimination.
  for (const f of G.fighters) {
    if (f.alive || f.deathProcessed) continue;
    f.deathProcessed = true;
    const kb = f.killedBy;
    const killer = kb ? G.fighters[kb.id] : null;
    if (killer && killer.team !== f.team) {
      killer.money = Math.min(MATCH.maxMoney, killer.money + REWARD.kill);
      G.feed.unshift({
        killer: killer.name, victim: f.name, weapon: kb.weapon, head: kb.head,
        kTeam: killer.team, vTeam: f.team, t: now,
      });
      G.feed.length = Math.min(G.feed.length, 5);
    }
    if (G.charge.carrier === f) {
      G.charge.carrier = null;
      G.charge.droppedAt = { x: f.pos.x, z: f.pos.z };
    }
    if (f.channel) f.channel = null;
  }
  if (playing) {
    if (aliveCount(TEAM.KOMODO) === 0 && G.phase === PHASE.LIVE) endRound(TEAM.GARUDA, 'elimination');
    else if (aliveCount(TEAM.GARUDA) === 0) endRound(TEAM.KOMODO, 'elimination');
    else if (aliveCount(TEAM.KOMODO) === 0 && G.phase === PHASE.PLANTED) { /* charge still ticks */ }
  }
}

function stepCharge(dt, now) {
  const c = G.charge;
  // Pickup: an attacker walking over the dropped charge takes it.
  if (c.droppedAt && !c.carrier && !c.planted) {
    for (const f of G.fighters) {
      if (f.team === TEAM.KOMODO && f.alive
        && Math.hypot(f.pos.x - c.droppedAt.x, f.pos.z - c.droppedAt.z) < 1.2) {
        c.carrier = f; c.droppedAt = null;
        break;
      }
    }
  }
  // Plant channel by the carrier.
  if (!c.planted && c.carrier && c.carrier.alive && c.carrier.channel === 'plant'
    && c.carrier.pos.x > SITE.x0 && c.carrier.pos.x < SITE.x1
    && c.carrier.pos.z > SITE.z0 && c.carrier.pos.z < SITE.z1) {
    c.plantProgress += dt;
    if (c.plantProgress >= MATCH.plantTime) {
      c.planted = true;
      c.plantPos = { x: c.carrier.pos.x, z: c.carrier.pos.z };
      c.planter = c.carrier;
      c.fuse = MATCH.chargeSeconds;
      G.phase = PHASE.PLANTED;
      c.carrier.money = Math.min(MATCH.maxMoney, c.carrier.money + REWARD.plant);
      for (const f of G.fighters) if (f.team === TEAM.KOMODO) f.money = Math.min(MATCH.maxMoney, f.money + REWARD.plantTeam);
      sfxWire();
    }
  } else if (!c.planted) {
    c.plantProgress = Math.max(0, c.plantProgress - dt * 2);
  }
  // Defuse channel by any defender in reach; a kit halves the time.
  if (c.planted && G.phase === PHASE.PLANTED) {
    let channeler = null;
    for (const f of G.fighters) {
      if (f.team === TEAM.GARUDA && f.alive && f.channel === 'defuse'
        && Math.hypot(f.pos.x - c.plantPos.x, f.pos.z - c.plantPos.z) < 2.4) { channeler = f; break; }
    }
    if (channeler) {
      c.defuser = channeler;
      c.defuseProgress += dt / (channeler.hasKit ? MATCH.defuseTime / 2 : MATCH.defuseTime);
      if (c.defuseProgress >= 1) {
        channeler.money = Math.min(MATCH.maxMoney, channeler.money + REWARD.defuse);
        sfxWire();
        endRound(TEAM.GARUDA, 'defuse');
      }
    } else {
      c.defuser = null;
      c.defuseProgress = Math.max(0, c.defuseProgress - dt * 0.25);
    }
  }
}

// screenshot staging

function stageShotFx(now) {
  // Keep the staged tracer and hitmarker alive across the capture window.
  if (G.shotFx && now - (G.shotFxAt || 0) > 0.09) {
    G.shotFxAt = now;
    G.shotFx();
    G.playerHitmark = { t: now, head: false, kill: false };
  }
}

// Positions a frozen, fully dressed tableau for each ?shot= name. Fighters,
export function setupShot(name) {
  const P = G.player;
  const bots = G.fighters.filter((f) => !f.isPlayer);
  const garuda = bots.filter((f) => f.team === TEAM.GARUDA);
  const komodo = bots.filter((f) => f.team === TEAM.KOMODO);
  const place = (f, x, z, yaw, opts = {}) => {
    f.pos.x = x; f.pos.z = z; f.pos.y = opts.y ?? 0;
    f.yaw = yaw; f.pitch = opts.pitch ?? 0;
    f.alive = opts.dead ? false : true;
    if (opts.dead) f.deadAt = performance.now() / 1000 - 0.16;
    f.crouch = !!opts.crouch;
    f.walkPhase = opts.walk ?? 0;
    if (opts.weapon) { f.weapons.primary = opts.weapon; f.current = 'primary'; ensureAmmo(f, opts.weapon); setFighterGun(f, opts.weapon); }
  };
  G.round = 6;
  G.score[TEAM.GARUDA] = 3; G.score[TEAM.KOMODO] = 2;
  P.armor = 2; P.armorHp = 100; P.hp = 100;

  if (name === 'buy') {
    place(P, 26, -20.5, -Math.PI / 2);
    P.weapons.primary = null; P.current = 'sidearm';
    P.money = 3450;
    G.phase = PHASE.BUY; G.phaseT = 9; G.roundTime = MATCH.roundSeconds;
    G.forceBuyOpen = true;
    place(garuda[0], 23.5, -18, -Math.PI / 2, { weapon: 'rusa' });
    place(garuda[1], 27.5, -17, -Math.PI / 2 + 0.4, { weapon: 'kijang' });
    place(garuda[2], 24, -22.5, -Math.PI / 2 - 0.3, {});
    place(garuda[3], 21, -20, -Math.PI / 2, { weapon: 'banteng' });
    komodo.forEach((f, i) => place(f, -26 + i * 1.5, 20, Math.PI * 0.78, {}));
    return;
  }
  if (name === 'action') {
    place(P, -6.5, 2.5, -Math.PI / 2 + 0.06, { weapon: 'elang' });
    P.hp = 64; P.money = 2150;
    G.phase = PHASE.LIVE; G.roundTime = 41;
    place(garuda[0], -9.5, 5.5, -Math.PI / 2 - 0.15, { weapon: 'banteng', walk: 2.2 });
    place(garuda[1], -4, -1, -Math.PI / 2, { weapon: 'rusa', crouch: true });
    place(garuda[2], 23.5, -18.5, -Math.PI / 2, { weapon: 'rusa' });
    place(garuda[3], 26, -16, -2.2, { weapon: 'banteng' });
    place(komodo[0], -16.5, 1.5, Math.PI / 2, { weapon: 'elang' });
    place(komodo[1], -22.5, 7, Math.PI / 2 - 0.4, { weapon: 'banteng', dead: true });
    place(komodo[2], -16, 12, Math.PI / 2 + 0.3, { weapon: 'rusa' });
    place(komodo[3], 8, -11.5, -0.8, { weapon: 'elang', y: 2.55 });
    place(komodo[4], 2, -2, 2.6, { weapon: 'banteng', walk: 4.1 });
    G.feed = [
      { killer: 'Sinta', victim: 'KOMODO-4', weapon: 'banteng', head: false, kTeam: TEAM.GARUDA, vTeam: TEAM.KOMODO, t: 0 },
      { killer: P.name, victim: 'KOMODO-2', weapon: 'elang', head: true, kTeam: TEAM.GARUDA, vTeam: TEAM.KOMODO, t: 0 },
    ];
    const shooter = garuda[0];
    G.shotFx = () => {
      const from = { x: shooter.pos.x - 0.8, y: 1.45, z: shooter.pos.z - 0.2 };
      muzzleFlash(from.x, from.y, from.z);
      spawnTracer(from.x, from.y, from.z, -18.6, 1.3, 1.1);
    };
    return;
  }
  if (name === 'plant') {
    place(P, 21.5, -20.5, -0.37, { weapon: 'banteng' });
    P.hp = 82; P.money = 1240;
    G.phase = PHASE.PLANTED; G.roundTime = 0;
    G.charge.planted = true;
    G.charge.plantPos = { x: 19, z: -14 };
    G.charge.fuse = 39.2;
    G.charge.defuser = garuda[0];
    G.charge.defuseProgress = 0.55;
    place(garuda[0], 18.1, -12.6, 2.6, { weapon: 'rusa', crouch: true });
    garuda[0].channel = 'defuse';
    place(garuda[1], 14.8, -9.5, 2.8, { weapon: 'elang' });
    place(garuda[2], 23.5, -18.5, -Math.PI / 2, { weapon: 'rusa', dead: true });
    place(garuda[3], 26, -16, -2.2, { weapon: 'banteng' });
    place(komodo[0], 14.5, -9.5, 2.6, { weapon: 'elang' });
    place(komodo[1], 21, -8.8, 2.9, { weapon: 'banteng', crouch: true });
    place(komodo[2], 8, -11.5, -0.8, { weapon: 'rusa', y: 2.55 });
    place(komodo[3], -19, 1, Math.PI / 2, { weapon: 'elang', dead: true });
    place(komodo[4], 2, -2, 2.6, { weapon: 'banteng', dead: true });
    return;
  }
  // cover (default): the opening frame itself — GARUDA spawn, round live,
  place(P, 22.5, -22.5, -0.45, { weapon: 'elang', pitch: -0.02 });
  P.money = 3450;
  G.phase = PHASE.LIVE; G.roundTime = 63;
  place(garuda[0], 20, -16.5, -0.5, { weapon: 'banteng', walk: 2.6 });
  place(garuda[1], 16, -15, -Math.PI / 2, { weapon: 'rusa', crouch: true });
  place(garuda[2], 13.8, -11, -0.7, { weapon: 'rusa', walk: 3.4 });
  place(garuda[3], 26, -16, -2.2, { weapon: 'banteng' });
  place(komodo[0], 4.5, -11.5, -Math.PI / 2, { weapon: 'elang', y: 2.55, walk: 1.4 });
  place(komodo[1], 9, -11.5, -0.8, { weapon: 'banteng', y: 2.55, walk: 1.4 });
  place(komodo[2], -19, 1, Math.PI / 2, { weapon: 'rusa' });
  place(komodo[3], -14, -9, 1.2, { weapon: 'banteng' });
  place(komodo[4], -24, 19, Math.PI * 0.78, { weapon: 'kijang' });
  const target = komodo[1];
  G.shotFx = () => {
    spawnTracer(P.pos.x - 0.5, 1.62, P.pos.z + 0.35, target.pos.x, 3.9, target.pos.z);
  };
}
