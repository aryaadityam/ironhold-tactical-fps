// IRONHOLD — procedural canvas textures. No image files exist in this game: every
// surface is painted here with grain, stains, streaks and wear, so nothing reads
// as one flat colour. Each painter draws at 256 or 512 px and is cached by name;

import * as THREE from 'three';

const cache = new Map();

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small deterministic painter RNG so textures look the same on every load.
function prand(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function grain(g, w, h, R, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = R();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${alpha * R()})` : `rgba(255,255,255,${alpha * 0.7 * R()})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}

function streaks(g, w, h, R, n, color) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = R() * w, len = 20 + R() * 90;
    g.globalAlpha = 0.05 + R() * 0.13;
    g.fillRect(x, R() * h * 0.4, 1.5 + R() * 3, len);
  }
  g.globalAlpha = 1;
}

function base(g, w, h, color, R, blotch) {
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {           // tonal patches, never one flat tone
    g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
    const bw = 30 + R() * 120, bh = 20 + R() * 80;
    g.fillRect(R() * (w - bw), R() * (h - bh), bw, bh);
  }
  if (blotch) {                             // damp rising from the bottom edge
    const grad = g.createLinearGradient(0, h, 0, h * 0.55);
    grad.addColorStop(0, 'rgba(10,10,12,0.35)');
    grad.addColorStop(1, 'rgba(10,10,12,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }
}

export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const R = prand(name.length * 7919 + name.charCodeAt(0) * 131);
  let tex;
  switch (name) {
    case 'concrete':
      tex = canvas(512, 512, (g, w, h) => {
        base(g, w, h, '#8d8578', R, true);
        grain(g, w, h, R, 5200, 0.10);
        streaks(g, w, h, R, 26, '#3d382f');
        g.strokeStyle = 'rgba(40,36,30,0.35)'; g.lineWidth = 1.4;  // hairline cracks
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          let x = R() * w, y = R() * h;
          g.moveTo(x, y);
          for (let j = 0; j < 5; j++) { x += (R() - 0.5) * 60; y += R() * 42; g.lineTo(x, y); }
          g.stroke();
        }
        g.fillStyle = 'rgba(30,28,24,0.20)';  // formwork seams
        g.fillRect(0, h * 0.5, w, 3); g.fillRect(w * 0.5, 0, 3, h);
      });
      break;
    case 'asphalt':
      tex = canvas(512, 512, (g, w, h) => {
        base(g, w, h, '#43444a', R, false);
        grain(g, w, h, R, 9000, 0.13);
        for (let i = 0; i < 9; i++) {                               // patched repairs
          g.fillStyle = 'rgba(16,16,20,0.25)';
          g.fillRect(R() * w * 0.8, R() * h * 0.8, 40 + R() * 90, 30 + R() * 60);
        }
        streaks(g, w, h, R, 14, '#101014');
      });
      break;
    case 'yardLine':
      tex = canvas(512, 512, (g, w, h) => {
        base(g, w, h, '#45464c', R, false);
        grain(g, w, h, R, 8000, 0.12);
        g.fillStyle = 'rgba(226,178,60,0.75)';  // worn painted line
        g.fillRect(0, h * 0.46, w, h * 0.07);
        for (let i = 0; i < 300; i++) {                             // paint worn away
          g.fillStyle = 'rgba(69,70,76,0.8)';
          g.fillRect(R() * w, h * 0.46 + R() * h * 0.07, 2 + R() * 5, 2);
        }
      });
      break;
    case 'containerTeal': case 'containerRust': case 'containerSand': {
      const colors = { containerTeal: '#2f6f6a', containerRust: '#9c4a2d', containerSand: '#a8894f' };
      tex = canvas(512, 256, (g, w, h) => {
        base(g, w, h, colors[name], R, true);
        for (let x = 0; x < w; x += 32) {                           // corrugation ribs
          g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(x, 0, 9, h);
          g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 9, 0, 4, h);
        }
        streaks(g, w, h, R, 34, '#2a1508');
        grain(g, w, h, R, 2600, 0.10);
        const ao = g.createLinearGradient(0, h * 0.62, 0, h);
        ao.addColorStop(0, 'rgba(8,6,4,0)'); ao.addColorStop(1, 'rgba(8,6,4,0.42)');
        g.fillStyle = ao; g.fillRect(0, h * 0.62, w, h * 0.38);
        const crown = g.createLinearGradient(0, 0, 0, h * 0.1);
        crown.addColorStop(0, 'rgba(255,240,210,0.10)'); crown.addColorStop(1, 'rgba(255,240,210,0)');
        g.fillStyle = crown; g.fillRect(0, 0, w, h * 0.1);
        g.fillStyle = 'rgba(240,236,226,0.85)';
        g.font = 'bold 44px system-ui, sans-serif';
        g.fillText(name === 'containerRust' ? 'GL-9 2204' : name === 'containerSand' ? 'KTU 8817' : 'SGR 3309', 36, 74);
        g.font = 'bold 21px system-ui, sans-serif';
        g.fillText('GARUDA LOGISTICS', 36, 108);
        g.font = '16px system-ui, sans-serif';
        g.fillText('MAX LOAD 24,000 KG', 36, 136);
      });
      break;
    }
    case 'corrugated':
      tex = canvas(256, 256, (g, w, h) => {
        base(g, w, h, '#7c8894', R, true);
        for (let x = 0; x < w; x += 16) {
          g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, 0, 5, h);
          g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 5, 0, 3, h);
        }
        streaks(g, w, h, R, 22, '#33241a');
        grain(g, w, h, R, 1600, 0.09);
      });
      break;
    case 'crateWood':
      tex = canvas(256, 256, (g, w, h) => {
        base(g, w, h, '#9a7748', R, false);
        for (let y = 0; y < h; y += 52) {                           // planks
          g.fillStyle = 'rgba(60,38,16,0.55)'; g.fillRect(0, y, w, 3);
          for (let i = 0; i < 12; i++) {                            // wood grain runs
            g.strokeStyle = `rgba(80,52,20,${0.10 + R() * 0.14})`;
            g.lineWidth = 1 + R() * 1.5;
            g.beginPath();
            const yy = y + 6 + R() * 42;
            g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + 3, w * 0.6, yy - 3, w, yy);
            g.stroke();
          }
        }
        g.strokeStyle = 'rgba(52,34,14,0.8)'; g.lineWidth = 14;  // frame edge
        g.strokeRect(0, 0, w, h);
        grain(g, w, h, R, 900, 0.08);
      });
      break;
    case 'metalPlate':
      tex = canvas(256, 256, (g, w, h) => {
        base(g, w, h, '#5d666e', R, false);
        grain(g, w, h, R, 2400, 0.10);
        g.fillStyle = 'rgba(20,22,26,0.8)';  // bolt heads
        for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) {
          g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
        }
        streaks(g, w, h, R, 12, '#1c1e22');
      });
      break;
    case 'hazard':
      tex = canvas(256, 128, (g, w, h) => {
        g.fillStyle = '#c9a227'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#1d1d20';
        for (let x = -h; x < w + h; x += 44) {
          g.beginPath();
          g.moveTo(x, h); g.lineTo(x + 22, 0); g.lineTo(x + 44, 0); g.lineTo(x + 22, h);
          g.fill();
        }
        grain(g, w, h, R, 1500, 0.16);  // heavily worn
      });
      break;
    case 'siteFloor':
      tex = canvas(512, 512, (g, w, h) => {
        g.translate(w / 2, h / 2); g.rotate(Math.PI); g.translate(-w / 2, -h / 2);
        base(g, w, h, '#4a4a4e', R, false);
        grain(g, w, h, R, 8000, 0.12);
        g.strokeStyle = 'rgba(226,178,60,0.9)'; g.lineWidth = 10;  // plant zone ring
        g.beginPath(); g.arc(w / 2, h / 2, 150, 0, 7); g.stroke();
        g.strokeStyle = 'rgba(226,178,60,0.5)'; g.lineWidth = 4;
        g.beginPath(); g.arc(w / 2, h / 2, 178, 0, 7); g.stroke();
        g.fillStyle = 'rgba(226,178,60,0.85)';
        g.font = 'bold 40px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('CHARGE ZONE 9', w / 2, h / 2 + 14);
        g.font = 'bold 19px system-ui, sans-serif';
        g.fillText('CRANE POWER CORE', w / 2, h / 2 + 46);
        g.textAlign = 'left';
      });
      break;
    case 'posterWall':
      tex = canvas(512, 512, (g, w, h) => {
        base(g, w, h, '#7e7a6e', R, true);
        grain(g, w, h, R, 4200, 0.10);
        const poster = (x, y, pw, ph, bgc, title, sub, tc) => {
          g.fillStyle = bgc; g.fillRect(x, y, pw, ph);
          g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x, y + ph - 12, pw, 12);
          g.fillStyle = tc; g.font = 'bold 25px system-ui, sans-serif';
          g.fillText(title, x + 14, y + 40);
          g.font = '16px system-ui, sans-serif';
          g.fillText(sub, x + 14, y + 68);
        };
        poster(36, 60, 200, 130, '#28418c', 'SAFETY FIRST', 'EVERY SHIFT, EVERY LOAD', '#e8ecf4');
        poster(268, 44, 208, 150, '#8c2f22', 'SECTOR 9', 'RESTRICTED — AUTHORIZED ONLY', '#f4e9e2');
        poster(60, 250, 170, 120, '#c9a227', 'KEEP CLEAR', 'FORKLIFT LANE', '#221d08');
        poster(280, 260, 190, 128, '#20503e', 'WAREHOUSE B', 'LOADING 05.00 - 21.00', '#e2f0e8');
        streaks(g, w, h, R, 18, '#2e2a22');
      });
      break;
    case 'brickPaint':
      tex = canvas(512, 512, (g, w, h) => {
        base(g, w, h, '#96755a', R, true);
        g.fillStyle = 'rgba(238,230,216,0.75)';  // painted-over band
        g.fillRect(0, h * 0.08, w, h * 0.30);
        g.fillStyle = 'rgba(30,40,90,0.85)';
        g.font = 'bold 52px system-ui, sans-serif';
        g.fillText('WAREHOUSE B — SECTOR 9', 26, h * 0.28);
        g.strokeStyle = 'rgba(52,40,30,0.4)'; g.lineWidth = 2;  // brick courses
        for (let y = 0; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        grain(g, w, h, R, 3800, 0.09);
      });
      break;
    default:
      tex = canvas(128, 128, (g, w, h) => { base(g, w, h, '#777777', R, false); });
  }
  cache.set(name, tex);
  return tex;
}

// Soft radial sprite used by smoke, dust, muzzle glow and hit puffs.
export function softCircleTexture() {
  if (cache.has('soft')) return cache.get('soft');
  const tex = canvas(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set('soft', tex);
  return tex;
}

// Dusk sky gradient, drawn once and wrapped on the inside of a big sphere.
export function skyTexture() {
  if (cache.has('sky')) return cache.get('sky');
  const tex = canvas(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#1c2340');
    grad.addColorStop(0.34, '#3c3a5e');
    grad.addColorStop(0.55, '#8a5a68');
    grad.addColorStop(0.72, '#d98a4e');
    grad.addColorStop(0.82, '#f2a95c');
    grad.addColorStop(1.0, '#f7c873');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const R = prand(42);
    for (let i = 0; i < 130; i++) {                               // early stars up top
      g.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.5})`;
      g.fillRect(R() * w, R() * h * 0.3, 1.6, 1.6);
    }
    for (let i = 0; i < 22; i++) {                                // thin dusk cloud bands
      g.fillStyle = `rgba(30,22,44,${0.10 + R() * 0.16})`;
      const y = h * (0.42 + R() * 0.4), cw = 120 + R() * 320;
      g.beginPath(); g.ellipse(R() * w, y, cw, 5 + R() * 9, 0, 0, 7); g.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set('sky', tex);
  return tex;
}
