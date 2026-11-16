// IRONHOLD — the heads-up display: health and armour, ammo and money, the
// round clock and score, alive pips, killfeed, hitmarkers, damage direction,
// plant and defuse progress, round banners, the buy menu (B), the scoreboard

import { MATCH, TEAM, TEAM_NAME, WEAPONS, GRENADES, GEAR, BUY_PRIMARIES } from './config.js';
import { G, PHASE, aliveCount } from './state.js';
import { input } from './player.js';
import { ensureAmmo } from './weapons.js';
import { sfxBuy, sfxClick } from './audio.js';

const $ = (id) => document.getElementById(id);
const els = {};
let buyOpen = false, lastPhase = '', lastRound = 0, bannerUntil = 0, scoreTab = false;

const BUY_ITEMS = [
  ...BUY_PRIMARIES.map((id) => ({ kind: 'primary', id, name: WEAPONS[id].name, price: WEAPONS[id].price })),
  ...Object.keys(GRENADES).map((id) => ({ kind: 'grenade', id, name: GRENADES[id].name, price: GRENADES[id].price })),
  { kind: 'armor', id: 'rompi', name: GEAR.rompi.name, price: GEAR.rompi.price },
  { kind: 'armor', id: 'rompiHelm', name: GEAR.rompiHelm.name, price: GEAR.rompiHelm.price },
  { kind: 'kit', id: 'kit', name: GEAR.kit.name, price: GEAR.kit.price },
];

export function initHud() {
  for (const id of ['timer', 'roundLabel', 'scoreG', 'scoreK', 'pipsG', 'pipsK', 'hpFill', 'hpText',
    'armorText', 'moneyText', 'weaponName', 'ammoText', 'nadeText', 'hitmarker', 'feed', 'banner',
    'bannerTitle', 'bannerSub', 'progressWrap', 'progressFill', 'progressLabel', 'interactHint',
    'dmgDir', 'flashOverlay', 'hurtVignette', 'scopeOverlay', 'buyMenu', 'buyGrid', 'buyMoney',
    'scoreboard', 'sbBody', 'menuOverlay', 'menuTitle', 'menuSub', 'menuBtn', 'crosshair',
    'phaseHint', 'deathNote']) els[id] = $(id);
  // Buy grid cells.
  BUY_ITEMS.forEach((item, i) => {
    const cell = document.createElement('button');
    cell.className = 'buyCell';
    cell.dataset.idx = i;
    cell.innerHTML = `<span class="buyKey">${i + 1}</span><span class="buyName">${item.name}</span><span class="buyPrice">$${item.price}</span>`;
    cell.addEventListener('click', () => buyItem(item));
    els.buyGrid.appendChild(cell);
  });
  els.menuBtn.addEventListener('click', () => { if (G.onRestart) G.onRestart(); });
}

export function buyOpenState() { return buyOpen; }

function canAfford(item) {
  const p = G.player;
  if (!p || !p.alive || G.phase !== PHASE.BUY) return false;
  if (p.money < item.price) return false;
  return !isOwned(item);
}

function buyItem(item) {
  const p = G.player;
  if (!canAfford(item)) { sfxBuy(false); return; }
  p.money -= item.price;
  if (item.kind === 'primary') {
    p.weapons.primary = item.id;
    p.ammo[item.id] = undefined;
    ensureAmmo(p, item.id);
  } else if (item.kind === 'grenade') {
    p.grenades[item.id]++;
  } else if (item.kind === 'armor') {
    p.armor = item.id === 'rompiHelm' ? 2 : 1;
    p.armorHp = 100;
  } else if (item.kind === 'kit') {
    p.hasKit = true;
  }
  sfxBuy(true);
  refreshBuyGrid();
}

function isOwned(item) {
  const p = G.player;
  return (item.kind === 'primary' && p.weapons.primary === item.id)
    || (item.kind === 'grenade' && p.grenades[item.id] >= 1)
    || (item.kind === 'armor' && item.id === 'rompi' && p.armor >= 1)
    || (item.kind === 'armor' && item.id === 'rompiHelm' && p.armor >= 2)
    || (item.kind === 'kit' && p.hasKit);
}

function refreshBuyGrid() {
  [...els.buyGrid.children].forEach((cell, i) => {
    cell.classList.toggle('afford', canAfford(BUY_ITEMS[i]));
    cell.classList.toggle('owned', isOwned(BUY_ITEMS[i]));
  });
  els.buyMoney.textContent = '$' + G.player.money;
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function showBanner(title, sub, dur = 2.4) {
  els.bannerTitle.textContent = title;
  els.bannerSub.textContent = sub || '';
  els.banner.style.opacity = 1;
  bannerUntil = G.time + dur;
}

export function updateHud() {
  const p = G.player;
  if (!p) return;
  const now = G.time;

  // Buy menu state: B toggles it in the buy phase; shot mode can
  if (input.pressed.has('KeyB') && G.phase === PHASE.BUY && p.alive) {
    buyOpen = !buyOpen;
    if (buyOpen) { refreshBuyGrid(); sfxClick(); }
  }
  if (G.phase !== PHASE.BUY) buyOpen = false;
  const showBuy = buyOpen || (G.shotMode && G.forceBuyOpen);
  els.buyMenu.style.display = showBuy ? 'block' : 'none';
  if (showBuy) {
    for (let i = 0; i < BUY_ITEMS.length; i++) {
      if (input.pressed.has('Digit' + (i + 1))) buyItem(BUY_ITEMS[i]);
    }
    refreshBuyGrid();
  }

  // Clock and score.
  let clock = G.roundTime, clockClass = '';
  if (G.phase === PHASE.BUY) { clock = G.phaseT; clockClass = 'buy'; }
  if (G.phase === PHASE.PLANTED) { clock = G.charge.fuse; clockClass = 'fuse'; }
  els.timer.textContent = fmtTime(clock);
  els.timer.className = 'timer ' + clockClass;
  els.roundLabel.textContent = 'ROUND ' + G.round;
  els.scoreG.textContent = G.score[TEAM.GARUDA];
  els.scoreK.textContent = G.score[TEAM.KOMODO];
  const pips = (team) => {
    const alive = aliveCount(team);
    let s = '';
    for (let i = 0; i < 5; i++) s += `<i class="${i < alive ? 'on' : ''}"></i>`;
    return s;
  };
  els.pipsG.innerHTML = pips(TEAM.GARUDA);
  els.pipsK.innerHTML = pips(TEAM.KOMODO);

  // Vital signs.
  els.hpFill.style.width = Math.max(0, p.hp) + '%';
  els.hpFill.style.background = p.hp > 35 ? 'var(--teal)' : '#e0483c';
  els.hpText.textContent = Math.ceil(Math.max(0, p.hp));
  els.armorText.textContent = p.armor > 0 ? `◈ ${Math.ceil(p.armorHp)}${p.armor === 2 ? ' + HELMET' : ''}` : '◈ —';
  els.moneyText.textContent = '$' + p.money;

  // Weapon and ammunition.
  const wid = p.current === 'grenade' ? null : p.weapons[p.current];
  if (p.current === 'grenade') {
    els.weaponName.textContent = GRENADES[p.grenadeKind].name;
    els.ammoText.textContent = '× ' + p.grenades[p.grenadeKind];
  } else if (wid) {
    const w = WEAPONS[wid];
    els.weaponName.textContent = w.name;
    if (wid === 'golok') els.ammoText.textContent = '—';
    else {
      const a = ensureAmmo(p, wid);
      const reloading = p.reloadUntil > now;
      els.ammoText.innerHTML = reloading ? '<span class="reloading">RELOADING…</span>' : `${a.mag} <small>/ ${a.reserve}</small>`;
    }
  }
  const nades = [];
  if (p.grenades.pecah) nades.push('FRAG');
  if (p.grenades.kilat) nades.push('FLASH');
  if (p.grenades.asap) nades.push('SMOKE');
  els.nadeText.textContent = nades.length ? 'ORDNANCE — ' + nades.join(' · ') : '';

  // Crosshair, hitmarker, scope.
  const scoped = input.zooming && wid && WEAPONS[wid].zoom >= 2;
  els.crosshair.style.opacity = (!p.alive || scoped || showBuy) ? 0 : 1;
  els.scopeOverlay.style.opacity = scoped && p.alive ? 1 : 0;
  const hm = G.playerHitmark;
  els.hitmarker.style.opacity = hm && now - hm.t < 0.22 ? 1 : 0;
  els.hitmarker.className = hm && hm.head ? 'head' : '';

  // Killfeed.
  els.feed.innerHTML = G.feed.filter((e) => now - e.t < 6 || G.shotMode)
    .map((e) => `<div class="feedRow"><b class="${e.kTeam === TEAM.GARUDA ? 'g' : 'k'}">${e.killer}</b><span>${WEAPONS[e.weapon]?.name || e.weapon}${e.head ? ' ⌖' : ''}</span><b class="${e.vTeam === TEAM.GARUDA ? 'g' : 'k'}">${e.victim}</b></div>`)
    .join('');

  // Damage direction and hurt feedback.
  const hurt = G.playerHurt;
  if (hurt && now - hurt.t < 0.9) {
    let rel = hurt.fromYaw - p.yaw;
    els.dmgDir.style.opacity = Math.max(0, 1 - (now - hurt.t) / 0.9);
    els.dmgDir.style.transform = `translate(-50%,-50%) rotate(${rel}rad)`;
    els.hurtVignette.style.opacity = 0.55;
  } else {
    els.dmgDir.style.opacity = 0;
    els.hurtVignette.style.opacity = p.hp < 35 && p.alive ? 0.3 + 0.18 * Math.sin(now * 5) : 0;
  }
  // Flash blindness.
  const flashLeft = p.flashUntil - now;
  els.flashOverlay.style.opacity = flashLeft > 0 ? Math.min(1, flashLeft / 1.1) : 0;

  // Channel progress: plant or defuse.
  const c = G.charge;
  let prog = -1, label = '';
  if (!c.planted && c.plantProgress > 0.02) { prog = c.plantProgress / MATCH.plantTime; label = 'CHARGE BEING PLANTED'; }
  if (c.planted && c.defuser) { prog = c.defuseProgress; label = c.defuser.isPlayer ? 'DEFUSING CHARGE…' : `${c.defuser.name} IS DEFUSING`; }
  els.progressWrap.style.display = prog >= 0 ? 'block' : 'none';
  if (prog >= 0) {
    els.progressFill.style.width = Math.min(100, prog * 100) + '%';
    els.progressLabel.textContent = label;
  }
  const nearCharge = c.planted && p.alive && Math.hypot(p.pos.x - c.plantPos.x, p.pos.z - c.plantPos.z) < 2.3;
  els.interactHint.style.opacity = nearCharge && !c.defuser ? 1 : 0;
  els.deathNote.style.opacity = !p.alive && G.phase !== PHASE.MATCHEND ? 1 : 0;

  // Phase hint line.
  els.phaseHint.textContent =
    G.phase === PHASE.BUY ? 'PRESS B TO BUY — ROUND STARTS SHORTLY'
    : G.phase === PHASE.PLANTED ? 'CHARGE ACTIVE — DEFUSE BEFORE DETONATION'
    : G.phase === PHASE.LIVE && c.droppedAt ? 'CHARGE DROPPED IN THE FIELD'
    : '';

  // Phase and round banners (never over the briefing).
  if (G.started && (G.phase !== lastPhase || G.round !== lastRound)) {
    if (G.phase === PHASE.BUY && !G.shotMode) showBanner('ROUND ' + G.round, p.team === TEAM.GARUDA ? 'HOLD SECTOR 9 — DO NOT LET THEM PLANT' : 'PLANT THE CHARGE AT THE CRANE POWER CORE');
    if (G.phase === PHASE.LIVE && lastPhase === PHASE.BUY && !G.shotMode) showBanner('', '', 0);
    if (G.phase === PHASE.PLANTED) showBanner('CHARGE PLANTED', 'CRANE POWER CORE · ' + Math.ceil(MATCH.chargeSeconds) + ' SECONDS TO DETONATION', 2);
    if (G.phase === PHASE.END && G.lastRound) {
      const won = G.lastRound.winner === p.team;
      const reasonText = { elimination: 'OPPOSITION ELIMINATED', detonation: 'CHARGE DETONATED AT THE POWER CORE', defuse: 'CHARGE DEFUSED', timeout: 'ROUND CLOCK EXPIRED' }[G.lastRound.reason];
      showBanner(won ? 'ROUND WON' : 'ROUND LOST', reasonText, MATCH.endSeconds - 0.3);
    }
    lastPhase = G.phase; lastRound = G.round;
  }
  if (bannerUntil && now > bannerUntil) { els.banner.style.opacity = 0; bannerUntil = 0; }

  // Scoreboard while Tab is held.
  scoreTab = input.keys.has('Tab');
  els.scoreboard.style.display = scoreTab ? 'block' : 'none';
  if (scoreTab) {
    const rows = [...G.fighters].sort((a, b) => b.kills - a.kills)
      .map((f) => `<tr class="${f.team === TEAM.GARUDA ? 'g' : 'k'} ${f.alive ? '' : 'dead'}"><td>${f.name}${f.isPlayer ? ' (YOU)' : ''}</td><td>${TEAM_NAME[f.team]}</td><td>${f.kills}</td><td>${f.deaths}</td><td>$${f.money}</td></tr>`)
      .join('');
    els.sbBody.innerHTML = rows;
  }

  // Match end screen.
  if (G.phase === PHASE.MATCHEND) {
    els.menuOverlay.style.display = 'flex';
    els.menuTitle.textContent = G.matchWinner === p.team ? 'SECTOR 9 HELD' : 'SECTOR 9 LOST';
    els.menuSub.textContent = `${TEAM_NAME[G.matchWinner]} WINS THE MATCH ${G.score[G.matchWinner]} — ${G.score[G.matchWinner === TEAM.GARUDA ? TEAM.KOMODO : TEAM.GARUDA]}. PRESS REDEPLOY TO PLAY AGAIN.`;
    els.menuBtn.textContent = 'REDEPLOY';
  } else if (G.started) {
    els.menuOverlay.style.display = 'none';
  }
}
