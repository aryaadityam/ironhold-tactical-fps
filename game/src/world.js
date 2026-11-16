// IRONHOLD — Sector 9: an original dusk-lit Indonesian industrial yard built for
// one bombsite. The map is data: every solid is an axis-aligned box that is at
// once a mesh, a physics collider and a sight blocker, so what you see is

import * as THREE from 'three';
import { getTexture, skyTexture, softCircleTexture } from './textures.js';
import { TEAM } from './config.js';

export const colliders = [];
export const SITE = { x0: 13.5, x1: 24.5, z0: -19.5, z1: -8.5, cx: 19, cz: -14 };

const matCache = new Map();
function mat(texName, rough = 0.92, repeatX = 1, repeatY = 1) {
  const key = texName + '|' + rough + '|' + repeatX + '|' + repeatY;
  if (matCache.has(key)) return matCache.get(key);
  const tex = getTexture(texName).clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeatX, repeatY);
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: 0.04 });
  matCache.set(key, m);
  return m;
}
const plainMat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.08 });

let scene = null;
const boxGeoCache = new Map();
function boxGeo(w, h, d) {
  const key = w + 'x' + h + 'x' + d;
  if (!boxGeoCache.has(key)) boxGeoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return boxGeoCache.get(key);
}

// One solid: mesh + collider. y0 is the base height (0 for almost everything,
function solid(cx, cz, w, d, h, material, y0 = 0, collide = true) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), material);
  mesh.position.set(cx, y0 + h / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (collide) colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1: y0 + h });
  return mesh;
}

function flat(cx, cz, w, d, material, y = 0.012) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, y, cz);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function barrel(x, z, color) {
  const g = new THREE.Group();
  const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.92, 14), plainMat(color, 0.5));
  bodyM.position.y = 0.46; bodyM.castShadow = true; bodyM.receiveShadow = true;
  g.add(bodyM);
  const rimM = plainMat(new THREE.Color(color).multiplyScalar(0.72).getHex(), 0.45);
  for (const ry of [0.22, 0.62]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.022, 6, 18), rimM);
    rim.rotation.x = Math.PI / 2; rim.position.y = ry; rim.castShadow = true;
    g.add(rim);
  }
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.035, 14), rimM);
  lid.position.y = 0.935; g.add(lid);
  g.position.set(x, 0, z);
  scene.add(g);
  colliders.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 0.92 });
}
function barrelCluster(x, z, color) { barrel(x, z, color); barrel(x + 0.62, z + 0.2, color); barrel(x + 0.3, z - 0.55, 0x5d666e); }

function lightPole(x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 8), plainMat(0x3a4046, 0.5));
  pole.position.set(x, 2.7, z); pole.castShadow = true; scene.add(pole);
  const head = new THREE.Mesh(boxGeo(0.9, 0.12, 0.3), plainMat(0x2c3034, 0.5));
  head.position.set(x, 5.42, z); scene.add(head);
  const lamp = new THREE.PointLight(0xffc98a, 18, 15, 1.8);
  lamp.position.set(x, 5.2, z); scene.add(lamp);
  colliders.push({ x0: x - 0.1, x1: x + 0.1, z0: z - 0.1, z1: z + 0.1, y0: 0, y1: 5.4 });
}

// Modelled detail overlays (realism pass): the core solids above carry the

function detailMat(color, rough = 0.58) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.35 });
}

function containerDetail(cx, cz, w, d, h, color, y0 = 0, door = true) {
  const g = new THREE.Group();
  const matD = detailMat(color);
  const longX = w >= d;
  const L = longX ? w : d, S = longX ? d : w;
  const n = Math.max(4, Math.floor(L / 0.29));
  const ribGeo = new THREE.BoxGeometry(0.07, h * 0.92, 0.05);
  const ribs = new THREE.InstancedMesh(ribGeo, matD, n * 2);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, longX ? 0 : Math.PI / 2, 0));
  const one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const t = -L / 2 + (i + 0.5) * (L / n);
    for (const sgn of [-1, 1]) {
      pv.set(longX ? cx + t : cx + sgn * (S / 2 + 0.02), y0 + h / 2, longX ? cz + sgn * (S / 2 + 0.02) : cz + t);
      m4.compose(pv, q, one);
      ribs.setMatrixAt(idx++, m4);
    }
  }
  ribs.castShadow = true; ribs.receiveShadow = true;
  g.add(ribs);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, h, 0.15), matD);
    post.position.set(cx + sx * (w / 2 - 0.03), y0 + h / 2, cz + sz * (d / 2 - 0.03));
    post.castShadow = true; g.add(post);
  }
  for (const sgn of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(longX ? w : 0.09, 0.09, longX ? 0.09 : d), matD);
    rail.position.set(longX ? cx : cx + sgn * (w / 2 - 0.03), y0 + h - 0.02, longX ? cz + sgn * (d / 2 - 0.03) : cz);
    g.add(rail);
  }
  if (door) {
    const dg = new THREE.Group();
    const rodM = detailMat(0x2b2e33, 0.45);
    for (const off of [-S * 0.24, S * 0.24]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h * 0.8, 6), rodM);
      rod.position.set(off, 0, 0.02); dg.add(rod);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), rodM);
      handle.position.set(off, -h * 0.06, 0.06); dg.add(handle);
    }
    const frameT = new THREE.Mesh(new THREE.BoxGeometry(S * 0.94, 0.1, 0.07), matD);
    frameT.position.y = h * 0.45; dg.add(frameT);
    const frameB = frameT.clone(); frameB.position.y = -h * 0.45; dg.add(frameB);
    if (longX) { dg.rotation.y = Math.PI / 2; dg.position.set(cx + w / 2 + 0.04, y0 + h / 2, cz); }
    else dg.position.set(cx, y0 + h / 2, cz + d / 2 + 0.04);
    g.add(dg);
  }
  scene.add(g);
}

function crateDetail(cx, cz, w, d, h, y0 = 0) {
  const g = new THREE.Group();
  const matD = detailMat(0x5f4630, 0.85);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), matD);
    b.position.set(cx + sx * (w / 2 - 0.03), y0 + h / 2, cz + sz * (d / 2 - 0.03));
    b.castShadow = true; g.add(b);
  }
  for (const sz of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.08, 0.08), matD);
    r.position.set(cx, y0 + h - 0.05, cz + sz * (d / 2 - 0.03)); g.add(r);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.08, 0.08), matD);
    r2.position.set(cx, y0 + 0.05, cz + sz * (d / 2 - 0.03)); g.add(r2);
  }
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, d + 0.04), matD);
    r.position.set(cx + sx * (w / 2 - 0.03), y0 + h - 0.05, cz); g.add(r);
  }
  scene.add(g);
}

function pallet(x, z, rotY) {
  const g = new THREE.Group();
  const m = detailMat(0x8a6f4d, 0.9);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.16), m);
    s.position.set(0, 0.135, -0.44 + i * 0.22); s.castShadow = true; g.add(s);
  }
  for (const sx of [-0.48, 0, 0.48]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 1.0), m);
    s.position.set(sx, 0.06, 0); g.add(s);
  }
  g.position.set(x, 0, z); g.rotation.y = rotY;
  scene.add(g);
}

function sandbagRow(x, z, rotY, n = 6) {
  const g = new THREE.Group();
  const m = detailMat(0x5a6142, 1);
  const geo = new THREE.SphereGeometry(0.34, 9, 7);
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < n - layer; i++) {
      const b = new THREE.Mesh(geo, m);
      b.scale.set(1, 0.46, 0.74);
      b.position.set((i - (n - layer - 1) / 2) * 0.55 + layer * 0.24, 0.15 + layer * 0.24, (i % 2 ? 0.03 : -0.03));
      b.rotation.y = (i % 2 ? 0.14 : -0.1);
      b.castShadow = true;
      g.add(b);
    }
  }
  g.position.set(x, 0, z); g.rotation.y = rotY;
  scene.add(g);
}

export const SPAWNS = [
  // GARUDA (defenders) — on and around the site, facing west into the yard
  [ { x: 22.5, z: -22.5, yaw: -0.45 }, { x: 24.5, z: -21.5, yaw: -Math.PI / 2 },
    { x: 27.5, z: -17, yaw: -Math.PI / 2 }, { x: 23.5, z: -18.5, yaw: -Math.PI / 2 },
    { x: 26, z: -22.5, yaw: -Math.PI / 2 } ],
  // KOMODO (attackers) — the south-west yard, facing north-east
  [ { x: -27, z: 20, yaw: Math.PI * 0.78 }, { x: -25, z: 21.5, yaw: Math.PI * 0.78 },
    { x: -28.5, z: 18, yaw: Math.PI * 0.78 }, { x: -24, z: 18.5, yaw: Math.PI * 0.78 },
    { x: -26, z: 22.5, yaw: Math.PI * 0.78 } ],
];

// Waypoint graph for the bots. y is the floor height at the node (catwalk 2.3).
export const NODES = [
  // 0..4 KOMODO approach, 5..9 warehouse doors and mid west
  { x: -24, z: 16.5, y: 0 }, { x: -22.5, z: 12.5, y: 0 }, { x: -23, z: 4, y: 0 }, { x: -23, z: -2, y: 0 }, { x: -16.8, z: 1.5, y: 0 },
  { x: -13, z: 1.5, y: 0 }, { x: -16.8, z: 9.5, y: 0 }, { x: -13, z: 9.5, y: 0 }, { x: -8, z: 14, y: 0 }, { x: -2, z: 8, y: 0 },
  // 10..14 mid yard, 15..19 catwalk (y 2.3) and its feet
  { x: 2, z: -1, y: 0 }, { x: -6, z: -3, y: 0 }, { x: 6, z: 8, y: 0 }, { x: 0, z: -7.5, y: 0 }, { x: -5, z: -9.5, y: 0 },
  { x: -11, z: -11.5, y: 0 }, { x: -6, z: -11.5, y: 2.3 }, { x: 0, z: -11.5, y: 2.3 }, { x: 6, z: -11.5, y: 2.3 }, { x: 10.5, z: -11.5, y: 0 },
  // 20..24 east yard, 25..29 the site
  { x: 11.5, z: 11.5, y: 0 }, { x: 16, z: 6, y: 0 }, { x: 22, z: 12, y: 0 }, { x: 26, z: 2, y: 0 }, { x: 20, z: -4, y: 0 },
  { x: 20, z: -7.5, y: 0 }, { x: 17, z: -12, y: 0 }, { x: 20.5, z: -15, y: 0 }, { x: 23.5, z: -18, y: 0 }, { x: 15, z: -17.5, y: 0 },
  // 30..33 connector and south run
  { x: 12.5, z: -12.5, y: 0 }, { x: -14, z: 19, y: 0 }, { x: -4, z: 19, y: 0 }, { x: 4, z: 17, y: 0 },
];
export const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [6, 7], [5, 10], [7, 8],
  [8, 9], [9, 10], [10, 11], [11, 13], [13, 14], [10, 12], [12, 20],
  [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 30], [30, 26],
  [20, 21], [21, 24], [24, 25], [25, 26], [26, 27], [27, 28], [26, 29],
  [29, 28], [21, 22], [22, 23], [23, 24], [0, 31], [31, 32], [32, 33],
  [33, 20], [33, 12], [8, 31], [5, 13], [28, 27], [30, 19],
];
export const ADJ = NODES.map(() => []);
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

// Defender posts and attacker routes, as node paths ending near the site.
export const DEFEND_POSTS = [27, 25, 18, 5, 21];
export const ATTACK_ROUTES = [
  [0, 1, 2, 3, 4, 5, 13, 14, 15, 16, 17, 18, 19, 30, 26],   // warehouse → catwalk → connector
  [0, 31, 32, 33, 12, 10, 13, 14, 15, 16, 17, 18, 19, 30, 26], // south run → mid → catwalk
  [0, 31, 32, 33, 20, 21, 24, 25, 26],                        // south run → east yard → south gate
  [0, 1, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 30, 26], // warehouse low → mid → catwalk
];

let dust = null, dustVel = null;

export function buildWorld(s) {
  scene = s;

  // Sky dome and light: a low warm sun in the west, long shadows, violet dusk.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0x59465a, 60, 190);
  scene.add(new THREE.HemisphereLight(0x9a86c0, 0x453a2e, 1.02));
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.38);
  fill.position.set(48, 26, -30);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffb066, 3.05);
  sun.position.set(-55, 34, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -52; sun.shadow.camera.right = 52;
  sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
  sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // Ground: asphalt sheet, lane lines, warehouse slab, site pad.
  flat(0, 0, 110, 84, mat('asphalt', 0.97, 14, 11), 0);
  flat(-23, 4, 17, 21, mat('concrete', 0.95, 3, 4), 0.015);
  flat(19, -14, 13, 13, mat('siteFloor', 0.9, 1, 1), 0.02);
  flat(-4, 18.5, 30, 1.4, mat('yardLine', 0.95, 6, 1), 0.014);
  flat(19, -2, 1.4, 22, mat('yardLine', 0.95, 1, 5), 0.014);

  const concrete = mat('concrete', 0.95, 2, 1);
  const corrugated = mat('corrugated', 0.6, 3, 1);

  // Perimeter walls.
  solid(0, -26.5, 70, 1, 4.2, concrete);
  solid(0, 26.5, 70, 1, 4.2, concrete);
  solid(-34.5, 0, 1, 54, 4.2, concrete);
  solid(34.5, 0, 1, 54, 4.2, concrete);

  // Warehouse (west): brick-painted long walls, poster wall facing mid.
  const brick = mat('brickPaint', 0.9, 2, 1);
  const poster = mat('posterWall', 0.92, 1.6, 1.6);
  solid(-23, -6.5, 17, 1, 4.6, brick);
  solid(-27.5, 14.5, 8, 1, 4.6, brick);
  solid(-17.5, 14.5, 6, 1, 4.6, brick);
  solid(-31.5, 4, 1, 21, 4.6, brick);
  solid(-14.5, -3.5, 1, 6, 4.6, poster);
  solid(-14.5, 5.5, 1, 5, 4.6, poster);
  solid(-14.5, 12.5, 1, 4, 4.6, poster);
  solid(-23, -1, 17, 10.5, 0.25, mat('metalPlate', 0.7, 4, 3), 4.6, false);
  solid(-23, -1, 0.8, 0.8, 4.6, concrete);
  solid(-23, 8, 0.8, 0.8, 4.6, concrete);
  // Warehouse dressing: twin wall pipes with drops, a louvered vent, an AC
  const pipeM = detailMat(0x4c554e, 0.4);
  for (const py of [3.45, 3.75]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 17, 8), pipeM);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(-13.82, py, 2); pipe.castShadow = true; scene.add(pipe);
  }
  for (const dz of [-3, 9]) {
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.4, 8), pipeM);
    drop.position.set(-13.82, 1.75, dz); scene.add(drop);
  }
  const vent = new THREE.Mesh(boxGeo(0.14, 0.95, 1.35), detailMat(0x3c4147, 0.5));
  vent.position.set(-13.9, 2.75, 5.5); scene.add(vent);
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(boxGeo(0.05, 0.09, 1.2), detailMat(0x22252a, 0.5));
    slat.position.set(-13.8, 2.42 + i * 0.22, 5.5); slat.rotation.z = 0.5; scene.add(slat);
  }
  const ac = new THREE.Mesh(boxGeo(0.95, 0.85, 1.15), detailMat(0x6a7076, 0.45));
  ac.position.set(-13.55, 0.43, 7.7); ac.castShadow = true; scene.add(ac);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), detailMat(0x1e2124, 0.4));
  fan.position.set(-13.06, 0.45, 7.7); fan.rotation.y = Math.PI / 2; scene.add(fan);
  // Inside the hall: crate stacks and a workbench wall.
  solid(-27, 2, 2.2, 1.4, 1.35, mat('crateWood', 0.9));
  solid(-27, 2, 1.8, 1.2, 1.1, mat('crateWood', 0.9), 1.35, false);
  solid(-19, 10, 2.4, 1.2, 1.2, mat('crateWood', 0.9));
  solid(-28.5, 9, 3.6, 0.9, 1.05, mat('metalPlate', 0.65));
  barrelCluster(-17.5, -3.5, 0x9c4a2d);

  // Mid yard: truck, container stacks, low cover.
  solid(0.5, 4, 6.4, 2.5, 2.75, mat('containerSand', 0.62, 1, 1));
  solid(4.9, 4, 1.7, 2.2, 1.95, plainMat(0x707a72, 0.5));
  const wheelM = detailMat(0x17181a, 0.9);
  const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.3, 14);
  for (const [wx, wz] of [[-1.9, 2.8], [-1.9, 5.2], [2.9, 2.8], [2.9, 5.2], [4.9, 2.8], [4.9, 5.2]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelM);
    wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.44, wz); wheel.castShadow = true; scene.add(wheel);
  }
  const shield = new THREE.Mesh(boxGeo(0.08, 0.62, 1.7), new THREE.MeshStandardMaterial({ color: 0x2c3844, roughness: 0.18, metalness: 0.55 }));
  shield.position.set(5.72, 1.42, 4); shield.rotation.z = -0.16; scene.add(shield);
  containerDetail(0.5, 4, 6.4, 2.5, 2.75, 0xa88f5f, 0, false);
  solid(-7, -5, 6, 2.4, 2.6, mat('containerTeal', 0.62));
  solid(-7.6, -5, 6, 2.4, 2.6, mat('containerTeal', 0.62), 2.6, false);
  solid(7, -6, 2.4, 6, 2.6, mat('containerRust', 0.62));
  containerDetail(-7, -5, 6, 2.4, 2.6, 0x25655a);
  containerDetail(-7.6, -5, 6, 2.4, 2.6, 0x25655a, 2.6, false);
  containerDetail(7, -6, 2.4, 6, 2.6, 0x8c3f2a);
  solid(-2, -9, 3.2, 0.9, 1.1, concrete);
  solid(4, 10.5, 3.2, 0.9, 1.1, concrete);
  solid(-10.5, 6, 0.9, 3.2, 1.1, concrete);
  barrelCluster(9.5, 1.5, 0x2f6f6a);
  barrelCluster(-11, -8, 0x9c4a2d);

  // Catwalk over mid-north: slab at 2.3, stairs of five steps at both ends.
  solid(0, -11.5, 19, 2.2, 0.25, mat('metalPlate', 0.6, 5, 1), 2.3);
  for (let i = 0; i < 5; i++) {                                          // west stairs, rising eastward
    const h = 0.46 * (i + 1);
    solid(-12.4 + i * 0.92, -11.5, 0.92, 2.2, h, mat('metalPlate', 0.6));
  }
  for (let i = 0; i < 5; i++) {                                          // east stairs, falling eastward
    const h = 2.3 - 0.46 * i;
    solid(10.1 + i * 0.92, -11.5, 0.92, 2.2, h, mat('metalPlate', 0.6));
  }
  for (const px of [-8, -3, 3, 8]) solid(px, -12.4, 0.28, 0.28, 2.3, plainMat(0x3a4046, 0.5));
  solid(0, -12.65, 19, 0.12, 0.9, plainMat(0x4a5058, 0.5), 2.55, false);  // rail, visual only

  // The fence line between mid and the east yard, with a door gap at z 10..13.
  solid(10.5, -1, 1, 7, 2.4, corrugated);
  solid(10.5, 6.5, 1, 8, 2.4, corrugated);
  solid(10.5, 19, 1, 13, 2.4, corrugated);
  solid(10.5, 11.5, 1.1, 0.35, 2.4, mat('hazard', 0.7), 0, false);

  // Catwalk railing: instanced balusters, a handrail and a mid rail.
  const balusterGeo = new THREE.BoxGeometry(0.05, 0.92, 0.05);
  const balusters = new THREE.InstancedMesh(balusterGeo, detailMat(0x3a3f45, 0.5), 42);
  {
    const m4 = new THREE.Matrix4();
    let bi = 0;
    for (let i = 0; i < 21; i++) {
      for (const bz of [-12.52, -10.48]) {
        m4.makeTranslation(-9.3 + i * 0.93, 3.01, bz);
        balusters.setMatrixAt(bi++, m4);
      }
    }
    balusters.count = bi;
  }
  balusters.castShadow = true;
  scene.add(balusters);
  for (const bz of [-12.52, -10.48]) {
    for (const ry of [3.48, 3.02]) {
      const rail = new THREE.Mesh(boxGeo(19, 0.05, 0.05), detailMat(0x454b52, 0.45));
      rail.position.set(0, ry, bz); scene.add(rail);
    }
  }

  // East yard.
  solid(24, 8, 2.4, 6, 2.6, mat('containerRust', 0.62));
  containerDetail(24, 8, 2.4, 6, 2.6, 0x8c3f2a);
  crateDetail(16, 2, 2.2, 1.4, 1.35);
  crateDetail(20, 13.5, 2.6, 1.6, 1.5);
  solid(16, 2, 2.2, 1.4, 1.35, mat('crateWood', 0.9));
  solid(20, 13.5, 2.6, 1.6, 1.5, mat('crateWood', 0.9));
  solid(28.5, -1, 2.2, 2.2, 1.8, mat('crateWood', 0.9));
  solid(15.5, 10, 4.5, 0.8, 1.6, concrete);
  barrelCluster(29.5, 13, 0x2f6f6a);

  // Site fences: south line (gate at x 18..22), west line (gate at z -14..-11).
  solid(15, -7.5, 6, 1, 2.3, corrugated);
  solid(26.5, -7.5, 9, 1, 2.3, corrugated);
  solid(12.5, -17.5, 1, 8, 2.3, corrugated);
  solid(12.5, -9.5, 1, 3.5, 2.3, corrugated);
  // Site cover: containers, crates, a low wall, the crane over the pad.
  solid(16.5, -17.5, 6, 2.4, 2.6, mat('containerTeal', 0.62));
  solid(23.5, -12, 2.4, 6, 2.6, mat('containerSand', 0.62));
  containerDetail(16.5, -17.5, 6, 2.4, 2.6, 0x25655a);
  containerDetail(23.5, -12, 2.4, 6, 2.6, 0xa88f5f);
  crateDetail(15.2, -10.2, 1.8, 1.3, 1.25);
  solid(20.5, -19.8, 3.4, 0.9, 1.1, concrete);
  solid(20.5, -19.8, 3.5, 1.0, 0.07, mat('hazard', 0.7), 1.1, false);
  solid(15.2, -10.2, 1.8, 1.3, 1.25, mat('crateWood', 0.9));
  barrelCluster(25.8, -16.5, 0x9c4a2d);
  for (const [lx, lz] of [[14.5, -19], [23.5, -19], [14.5, -9.5], [23.5, -9.5]]) {
    solid(lx, lz, 0.42, 0.42, 6.2, plainMat(0x8a6a34, 0.55));
  }
  solid(19, -19, 9.8, 0.5, 0.6, plainMat(0x8a6a34, 0.55), 5.9, false);
  solid(19, -9.5, 9.8, 0.5, 0.6, plainMat(0x8a6a34, 0.55), 5.9, false);
  solid(19, -14.25, 0.5, 10, 0.6, plainMat(0x9c7838, 0.55), 5.9, false);
  solid(19, -14, 1.1, 1.1, 1.3, mat('hazard', 0.6), 4.4, false);

  // KOMODO spawn yard dressing.
  solid(-18, 20.5, 6, 2.4, 2.6, mat('containerRust', 0.62));
  containerDetail(-18, 20.5, 6, 2.4, 2.6, 0x8c3f2a);
  solid(-11.5, 22, 2.2, 1.4, 1.35, mat('crateWood', 0.9));
  barrelCluster(-29.5, 14.5, 0x2f6f6a);

  // Ground truth: oil stains worn into the asphalt, scattered debris,
  const stainM = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.22, metalness: 0.25, transparent: true, opacity: 0.82 });
  [[2.5, 6.8, 1.6], [-12.8, 3.2, 1.1], [19, -5.6, 1.35], [8.5, -1.5, 0.9], [-4, 13.5, 1.25], [24.5, -8.5, 1.0], [15, -20.5, 0.85], [-20, 16, 1.15]].forEach(([sx, sz, sr], i) => {
    const st = new THREE.Mesh(new THREE.CircleGeometry(sr, 18), stainM);
    st.rotation.x = -Math.PI / 2; st.position.set(sx, 0.03 + i * 0.0006, sz);
    st.receiveShadow = true; scene.add(st);
  });
  {
    const debGeo = new THREE.BoxGeometry(0.24, 0.11, 0.12);
    const debris = new THREE.InstancedMesh(debGeo, detailMat(0x6e5138, 0.95), 64);
    const m4 = new THREE.Matrix4(), e = new THREE.Euler(), qt = new THREE.Quaternion(), sv = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
    let di = 0, guard = 0;
    while (di < 64 && guard++ < 400) {
      const dx = -31 + Math.random() * 62, dz = -24 + Math.random() * 48;
      if (dx > 11 && dx < 27 && dz > -22 && dz < -6) continue;
      if (dx < -14.5 && dz > -8 && dz < 16) continue;
      e.set(0, Math.random() * Math.PI, 0); qt.setFromEuler(e);
      pv.set(dx, 0.055, dz);
      m4.compose(pv, qt, sv);
      debris.setMatrixAt(di++, m4);
    }
    debris.count = di;
    debris.receiveShadow = true;
    scene.add(debris);
  }
  pallet(-15.8, 12.5, 0.4);
  pallet(26.5, -5.5, -0.3);
  pallet(11.5, 16.5, 1.1);
  sandbagRow(19.5, -6.6, 0.05, 6);
  sandbagRow(-12.6, 5.2, Math.PI / 2, 5);
  {
    const tireM = detailMat(0x1b1c1e, 0.92);
    for (let i = 0; i < 3; i++) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.105, 8, 18), tireM);
      tire.rotation.x = Math.PI / 2; tire.position.set(28.2, 0.12 + i * 0.21, 5.6);
      tire.castShadow = true; scene.add(tire);
    }
    const lean = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.105, 8, 18), tireM);
    lean.position.set(27.4, 0.28, 6.3); lean.rotation.set(0.3, 0.5, 1.2); scene.add(lean);
    const spoolM = detailMat(0x6e5138, 0.85);
    for (const fx of [-0.3, 0.3]) {
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.08, 16), spoolM);
      fl.rotation.z = Math.PI / 2; fl.position.set(-12 + fx, 0.56, 17.5); fl.castShadow = true; scene.add(fl);
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 12), detailMat(0x2e2a24, 0.9));
    core.rotation.z = Math.PI / 2; core.position.set(-12, 0.56, 17.5); scene.add(core);
  }

  lightPole(-4, -14);
  lightPole(14, 2);
  lightPole(-20, 17.5);

  // Distant silhouettes beyond the walls, so sightlines end in a skyline.
  const sil = plainMat(0x35304a, 1);
  for (const [x, z, w, h, d] of [[-50, -40, 26, 17, 14], [8, -48, 34, 22, 16], [52, -30, 20, 14, 14],
                                 [56, 22, 22, 12, 16], [-54, 26, 24, 15, 14], [-16, 52, 40, 13, 16]]) {
    const m = new THREE.Mesh(boxGeo(w, h, d), sil);
    m.position.set(x, h / 2, z);
    scene.add(m);
  }

  // Floating dust in the low sun: points drifting slowly over the yard.
  const N = 260;
  const pos = new Float32Array(N * 3);
  dustVel = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = -30 + Math.random() * 60;
    pos[i * 3 + 1] = 0.3 + Math.random() * 4.5;
    pos[i * 3 + 2] = -22 + Math.random() * 44;
    dustVel[i * 2] = 0.12 + Math.random() * 0.3;
    dustVel[i * 2 + 1] = (Math.random() - 0.5) * 0.08;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({
    map: softCircleTexture(), size: 0.14, transparent: true, opacity: 0.5,
    depthWrite: false, color: 0xffd9a0, sizeAttenuation: true,
  }));
  scene.add(dust);
}

export function updateDust(dt, t) {
  if (!dust) return;
  const p = dust.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) + dustVel[i * 2] * dt;
    let y = p.getY(i) + Math.sin(t * 0.6 + i) * 0.02 * dt * 8;
    if (x > 32) x = -32;
    p.setX(i, x);
    p.setY(i, Math.max(0.25, Math.min(5, y)));
  }
  p.needsUpdate = true;
}

// Highest floor at (x,z) a fighter standing at feetY can step onto: the top of
export function groundHeightAt(x, z, feetY, step = 0.56) {
  let ground = 0;
  for (const c of colliders) {
    if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) {
      if (c.y1 <= feetY + step && c.y1 > ground) ground = c.y1;
    }
  }
  return ground;
}

// Ray vs the static world: slab test against every collider. Returns the
export function rayVsWorld(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = maxDist;
  for (const c of colliders) {
    let t0 = 0, t1 = best;
    // X slab
    if (Math.abs(dx) < 1e-9) { if (ox < c.x0 || ox > c.x1) continue; }
    else {
      let ta = (c.x0 - ox) / dx, tb = (c.x1 - ox) / dx;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    // Y slab
    if (Math.abs(dy) < 1e-9) { if (oy < c.y0 || oy > c.y1) continue; }
    else {
      let ta = (c.y0 - oy) / dy, tb = (c.y1 - oy) / dy;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    // Z slab
    if (Math.abs(dz) < 1e-9) { if (oz < c.z0 || oz > c.z1) continue; }
    else {
      let ta = (c.z0 - oz) / dz, tb = (c.z1 - oz) / dz;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    if (t0 < best && t0 > 0.001) best = t0;
  }
  return best;
}

// Line of sight between two points, blocked by colliders or by a smoke volume.
export function losClear(ax, ay, az, bx, by, bz, smokes) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.01) return true;
  const hit = rayVsWorld(ax, ay, az, dx / dist, dy / dist, dz / dist, dist);
  if (hit < dist - 0.05) return false;
  if (smokes) {
    for (const s of smokes) {
      // distance from the segment to the smoke centre, in 3D
      const t = Math.max(0, Math.min(1,
        ((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / (dist * dist)));
      const px = ax + dx * t - s.x, py = ay + dy * t - s.y, pz = az + dz * t - s.z;
      if (px * px + py * py + pz * pz < s.r * s.r * 0.72) return false;
    }
  }
  return true;
}

export { TEAM };
