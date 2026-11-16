// IRONHOLD — configuration: teams, weapons, economy, round timing and tuning.
// Everything the rest of the game balances against lives here, in one place, so a
// number is never hunted through the code. All names are original to IRONHOLD:

export const TEAM = { GARUDA: 0, KOMODO: 1 };
export const TEAM_NAME = ['GARUDA', 'KOMODO'];
export const TEAM_COLOR = [0x2e8f77, 0xc2503c];  // teal-green, rust red

export const MATCH = {
  winRounds: 7,
  maxRounds: 13,
  buySeconds: 12,
  roundSeconds: 100,
  chargeSeconds: 40,
  endSeconds: 4.5,
  plantTime: 3.0,
  defuseTime: 5.0,
  startMoney: 800,
  maxMoney: 16000,
};

export const REWARD = {
  kill: 300,
  plant: 300,
  plantTeam: 800,
  defuse: 300,
  winElimination: 3250,
  winObjective: 3500,
  winTimeout: 3250,
  lossBase: 1400,
  lossStep: 500,
  lossMax: 3400,
};

// Weapon table. spread is in degrees at rest; moveSpread multiplies it by the
export const WEAPONS = {
  golok: {
    name: 'Machete', price: 0, damage: 55, headMult: 1.5,
    rpm: 110, mag: 0, reserve: 0, reload: 0, range: 1.7,
    spread: 0, moveSpread: 1, bloom: 0, auto: false, pellets: 1,
    falloffStart: 1.7, falloffEnd: 1.7, zoom: 1, speed: 1.0, kick: 0.4,
  },
  kijang: {
    name: 'P1 Kestrel', price: 0, damage: 26, headMult: 3.2,
    rpm: 380, mag: 12, reserve: 96, reload: 1.15, range: 120,
    spread: 0.55, moveSpread: 2.6, bloom: 0.16, auto: false, pellets: 1,
    falloffStart: 18, falloffEnd: 55, zoom: 1, speed: 0.98, kick: 0.55,
  },
  rusa: {
    name: 'SMG-9 Viper', price: 1000, damage: 21, headMult: 2.6,
    rpm: 800, mag: 32, reserve: 128, reload: 1.7, range: 120,
    spread: 1.05, moveSpread: 2.2, bloom: 0.10, auto: true, pellets: 1,
    falloffStart: 12, falloffEnd: 42, zoom: 1, speed: 1.0, kick: 0.34,
  },
  badak: {
    name: 'SG-12 Boar', price: 1100, damage: 11, headMult: 2.0,
    rpm: 68, mag: 6, reserve: 30, reload: 2.6, range: 60,
    spread: 4.4, moveSpread: 1.8, bloom: 0.2, auto: false, pellets: 8,
    falloffStart: 6, falloffEnd: 22, zoom: 1, speed: 0.94, kick: 1.5,
  },
  banteng: {
    name: 'KRB-4 Rhino', price: 2500, damage: 30, headMult: 3.0,
    rpm: 700, mag: 25, reserve: 100, reload: 1.9, range: 160,
    spread: 0.78, moveSpread: 2.8, bloom: 0.11, auto: true, pellets: 1,
    falloffStart: 24, falloffEnd: 80, zoom: 1.12, speed: 0.95, kick: 0.5,
  },
  elang: {
    name: 'AR-7 Falcon', price: 2900, damage: 33, headMult: 3.1,
    rpm: 640, mag: 30, reserve: 90, reload: 2.1, range: 170,
    spread: 0.68, moveSpread: 3.0, bloom: 0.12, auto: true, pellets: 1,
    falloffStart: 28, falloffEnd: 90, zoom: 1.12, speed: 0.94, kick: 0.62,
  },
  cendrawasih: {
    name: 'LR-8 Osprey', price: 4750, damage: 112, headMult: 3.0,
    rpm: 42, mag: 5, reserve: 25, reload: 2.9, range: 260,
    spread: 0.06, moveSpread: 6.0, bloom: 0.3, auto: false, pellets: 1,
    falloffStart: 60, falloffEnd: 200, zoom: 3.2, speed: 0.9, kick: 2.4,
  },
};

export const GRENADES = {
  pecah: { name: 'Frag Grenade', price: 300, damage: 92, radius: 5.2 },
  kilat: { name: 'Flashbang', price: 200, radius: 19 },
  asap: { name: 'Smoke Grenade', price: 300, radius: 3.4, life: 14 },
};

export const GEAR = {
  rompi: { name: 'Steel Vest', price: 650 },
  rompiHelm: { name: 'Vest + Helmet', price: 1000 },
  kit: { name: 'Defusal Kit', price: 200 },
};

// The buy menu, in display order: [key, label, priceOf] rows are built in hud.js
export const BUY_PRIMARIES = ['rusa', 'badak', 'banteng', 'elang', 'cendrawasih'];

// Bot tuning: reaction and error are what keep gunfire honest on both sides.
export const BOT = {
  thinkInterval: 0.12,
  seeRange: 46,
  seeFovCos: -0.35,
  hearRange: 34,
  reactionMin: 0.38,
  reactionMax: 0.62,
  aimErrorDeg: 1.9,
  burstMin: 3,
  burstMax: 6,
  burstPause: 0.34,
};

export const PLAYER = {
  radius: 0.35,
  height: 1.68,
  crouchHeight: 1.24,
  eye: 1.58,
  crouchEye: 1.12,
  walkSpeed: 4.6,
  sprintSpeed: 6.5,
  crouchSpeed: 2.2,
  accel: 42,
  friction: 9.5,
  jumpSpeed: 4.4,
  gravity: 12.5,
};
