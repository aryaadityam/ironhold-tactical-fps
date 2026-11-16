// IRONHOLD — the single game state. Every module reads and writes here instead of
// keeping private copies, so a round reset is one function and the HUD always
// shows the same truth the simulation used. Rendering state (meshes, materials)

import { MATCH } from './config.js';

export const PHASE = { BUY: 0, LIVE: 1, PLANTED: 2, END: 3, MATCHEND: 4 };

export const G = {
  phase: PHASE.BUY,
  phaseT: 0,
  time: 0,
  roundTime: MATCH.roundSeconds,
  round: 1,
  score: [0, 0],         // rounds won, by team index
  lossStreak: [0, 0],
  fighters: [],
  player: null,
  charge: {
    carrier: null,
    droppedAt: null,
    planted: false,
    plantPos: null,
    fuse: MATCH.chargeSeconds,
    planter: null,
    defuser: null,
    defuseProgress: 0,
    plantProgress: 0,
  },
  noises: [],
  smokes: [],
  grenades: [],
  winner: -1,
  matchWinner: -1,
  feed: [],
  playerHitmark: null,
  playerHurt: null,
  forceBuyOpen: false,
  started: false,
  shotFx: null,
  shotFxAt: 0,
  onBotGrenade: null,
  onRestart: null,
  shotMode: null,
};

// A fighter is the simulation record of one combatant, human or bot. Its mesh
export function makeFighter(id, team, isPlayer, name) {
  return {
    id, team, isPlayer, name,
    alive: true,
    hp: 100,
    armor: 0, armorHp: 0,   // vest tier (0/1/2) and its remaining absorption
    hasKit: false,
    money: MATCH.startMoney,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0,
    crouch: false,
    grounded: true,
    weapons: { primary: null, sidearm: 'kijang', melee: 'golok' },
    current: 'sidearm',
    grenades: { pecah: 0, kilat: 0, asap: 0 },
    grenadeKind: 'pecah',
    ammo: {},
    reloadUntil: 0,
    nextShotAt: 0,
    bloom: 0,
    kills: 0, deaths: 0,
    brain: null,
    // Render hooks (characters.js) and combat bookkeeping (weapons/sim):
    group: null, walkPhase: 0, speed2d: 0, deadAt: 0, flashUntil: 0,
    punch: 0, channel: null, deathProcessed: false, killedBy: null,
    hitFlashUntil: 0, lastAttacker: null, muzzleObj: null, viewMuzzle: null,
    drawUntil: 0, wantFire: false, wantThrow: false, prevFireHeld: false,
    reloadId: null,
  };
}

export function resetMatch() {
  G.score = [0, 0];
  G.lossStreak = [0, 0];
  G.round = 1;
  G.matchWinner = -1;
  G.feed = [];
  G.playerHitmark = null;
  G.playerHurt = null;
  for (const f of G.fighters) {
    f.money = MATCH.startMoney;
    f.kills = 0; f.deaths = 0;
    f.weapons = { primary: null, sidearm: 'kijang', melee: 'golok' };
    f.armor = 0; f.armorHp = 0; f.hasKit = false;
    f.grenades = { pecah: 0, kilat: 0, asap: 0 };
  }
}

// Round reset: everyone alive again on full health; weapons and money persist
export function resetRound() {
  G.phase = PHASE.BUY;
  // G.time is the monotonic match clock and deliberately survives the round:
  G.roundTime = MATCH.roundSeconds;
  G.winner = -1;
  G.noises.length = 0;
  G.smokes.length = 0;
  G.grenades.length = 0;
  const c = G.charge;
  c.carrier = null; c.droppedAt = null; c.planted = false; c.plantPos = null;
  c.fuse = MATCH.chargeSeconds; c.planter = null; c.defuser = null;
  c.defuseProgress = 0; c.plantProgress = 0;
  for (const f of G.fighters) {
    if (!f.alive && f.weapons.primary) {
      // died holding it: the primary is gone with the round
      f.weapons.primary = null;
    }
    f.alive = true;
    f.hp = 100;
    f.current = f.weapons.primary ? 'primary' : 'sidearm';
    f.bloom = 0;
    f.punch = 0;
    f.channel = null;
    f.deathProcessed = false;
    f.killedBy = null;
    f.hitFlashUntil = 0;
    f.reloadUntil = 0;
    f.flashUntil = 0;
    f.vel.x = 0; f.vel.y = 0; f.vel.z = 0;
    for (const id of Object.keys(f.ammo)) delete f.ammo[id];
  }
}

export function aliveCount(team) {
  let n = 0;
  for (const f of G.fighters) if (f.team === team && f.alive) n++;
  return n;
}

// A deterministic RNG for screenshot setups and bot tie-breaks; normal play
let rngState = 1234567;
export function seedRng(seed) { rngState = seed >>> 0 || 1; }
export function rng() {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}
export function rngRange(a, b) { return a + rng() * (b - a); }
