// IRONHOLD — bootstrap and the frame loop. Builds the renderer (ACES tone
// mapping, PCF shadows, pixel ratio capped at 1.5), the world, the ten
// fighters and their meshes, then runs the simulation at a fixed 60 Hz with

import * as THREE from 'three';
import { TEAM } from './config.js';
import { G, PHASE, makeFighter, seedRng } from './state.js';
import { buildWorld, updateDust } from './world.js';
import { buildFighterMesh, syncFighterMesh } from './characters.js';
import { initFx, tickFx } from './fx.js';
import { initPlayer, input, poseCamera } from './player.js';
import { initSim, startMatch, step, setupShot } from './sim.js';
import { initHud, updateHud } from './hud.js';
import { initAudio, startAmbient } from './audio.js';

const STEP = 1 / 60;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 700);
scene.add(camera);
// A soft warm fill riding the camera keeps the held weapon readable against
const camFill = new THREE.PointLight(0xffdfba, 1.6, 4.5, 2);
camera.add(camFill);

buildWorld(scene);
initFx(scene);

// The ten fighters: the human leads GARUDA; everyone else is a bot.
G.player = makeFighter(0, TEAM.GARUDA, true, 'Arya');
G.fighters.push(G.player);
let nextId = 1;
for (const [team, names] of [[TEAM.GARUDA, ['Sinta', 'Bagas', 'Dewi', 'Raka']],
                             [TEAM.KOMODO, ['Damar', 'Gilang', 'Surya', 'Panji', 'Wira']]]) {
  for (const name of names) G.fighters.push(makeFighter(nextId++, team, false, name));
}
for (const f of G.fighters) {
  f.group = buildFighterMesh(f.team, f.name);
  if (f.isPlayer) f.group.visible = false;
  scene.add(f.group);
}

initPlayer(camera, renderer.domElement);
initHud();
initSim();
window.__game = G; // debug and playtest handle

function startGame() {
  initAudio();
  startAmbient();
  startMatch();
  G.started = true;
  if (!G.shotMode) renderer.domElement.requestPointerLock();
}
G.onRestart = startGame;
document.getElementById('menuOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'menuOverlay' && !G.started) startGame();
});

// Screenshot mode: a named, seeded tableau instead of a live match.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  G.shotMode = shot;
  seedRng(9);
  startMatch();
  setupShot(shot);
  G.started = true;
  document.getElementById('menuOverlay').style.display = 'none';
} else {
  // Title screen: a live match is staged behind the briefing — fighters on
  startMatch();
}
const menuYaw = G.player ? G.player.yaw : 0;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now() / 1000;
let acc = 0;
let frames = 0;

function loop() {
  requestAnimationFrame(loop);
  const nowS = performance.now() / 1000;
  let frameDt = Math.min(0.1, nowS - last);
  last = nowS;

  if (G.started) {
    acc += frameDt;
    let n = 0;
    while (acc >= STEP && n < 5) { step(STEP); acc -= STEP; n++; }
    if (n === 5) acc = 0;
    if (G.phase === PHASE.MATCHEND && input.pressed.has('KeyR')) startGame();
  }

  // Before deployment, the briefing camera drifts slowly over the spawn
  if (!G.started && !G.shotMode && G.player) {
    G.player.yaw = menuYaw + Math.sin(nowS * 0.1) * 0.07;
    G.player.pitch = Math.sin(nowS * 0.073) * 0.02;
  }

  for (const f of G.fighters) syncFighterMesh(f, frameDt, nowS);
  if (G.player) poseCamera(G.player, frameDt);
  tickFx(frameDt, nowS);
  updateDust(frameDt, nowS);
  updateHud();
  input.pressed.clear();
  renderer.render(scene, camera);

  frames++;
  if (G.shotMode && frames === 20) window.__shotReady = true;
}
loop();
