// Launch Complex 39B style site. Site origin = pad centre at ground level. +x east (ocean), +z south (crawlerway / VAB).
import * as THREE from 'three';
import { TAU, DEG, rng, revolve, dome, ctex, speckle, Batch, truss, at, lerp, ease, smooth } from './util.js';

export const PAD_Y = 12, DECK_TOP = 26, ROCKET_BASE = 27;
export const LAND = '#5f7550', SEA = '#1d5a86';
export const rampY = z => (z < 60 ? PAD_Y : z < 230 ? PAD_Y * (230 - z) / 170 : 0);

const LAGOON_SEEDS = [[-520, 920, 380, 420], [760, 1350, 170, 420], [-1250, -900, 520, 360], [700, -1300, 200, 380], [-1500, 300, 260, 520]];
const LAGOONS = [];
{ // each lagoon is a cluster of overlapping ellipses, so the shore line looks natural
  const r = rng(77);
  for (const [cx, cz, rx, rz] of LAGOON_SEEDS) {
    LAGOONS.push([cx, cz, rx * .72, rz * .72, 0]);
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = .25 + r() * .4; LAGOONS.push([cx + Math.cos(a) * rx * d, cz + Math.sin(a) * rz * d, rx * (.3 + r() * .3), rz * (.3 + r() * .3), r() * 3]); }
  }
}
export function isWater(x, z) {
  if (x > 950) return true;
  for (const [cx, cz, rx, rz] of LAGOONS) if (((x - cx) / (rx + 12)) ** 2 + ((z - cz) / (rz + 12)) ** 2 < 1) return true;
  return false;
}

function quadGeo(quads, uvScale = 8) {
  const pos = [], nor = [], uv = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  for (const { p, out } of quads) {
    A.set(...p[0]); B.set(...p[1]); C.set(...p[2]);
    N.copy(B).sub(A).cross(C.clone().sub(A)).normalize();
    let order = [0, 1, 2, 0, 2, 3];
    if (N.dot(new THREE.Vector3(...out)) < 0) { order = [0, 2, 1, 0, 3, 2]; N.negate(); }
    for (const i of order) {
      const v = p[i]; pos.push(...v); nor.push(N.x, N.y, N.z);
      if (Math.abs(N.y) > .5) uv.push(v[0] / uvScale, v[2] / uvScale);
      else if (Math.abs(N.x) > Math.abs(N.z)) uv.push(v[2] / uvScale, v[1] / uvScale);
      else uv.push(v[0] / uvScale, v[1] / uvScale);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/** solid with a rectangular base at y=0 and a rectangular top at height y */
function hexa(b, t) {
  const [bx0, bx1, bz0, bz1] = b, [tx0, tx1, tz0, tz1, y] = t;
  const B = [[bx0, 0, bz0], [bx1, 0, bz0], [bx1, 0, bz1], [bx0, 0, bz1]], T = [[tx0, y, tz0], [tx1, y, tz0], [tx1, y, tz1], [tx0, y, tz1]];
  return quadGeo([
    { p: [T[0], T[1], T[2], T[3]], out: [0, 1, 0] },
    { p: [B[0], B[1], T[1], T[0]], out: [0, 0, -1] },
    { p: [B[1], B[2], T[2], T[1]], out: [1, 0, 0] },
    { p: [B[2], B[3], T[3], T[2]], out: [0, 0, 1] },
    { p: [B[3], B[0], T[0], T[3]], out: [-1, 0, 0] },
  ]);
}

export function buildSite() {
  const r = rng(5);
  const S = o => new THREE.MeshStandardMaterial(o);
  const site = new THREE.Group(); site.name = 'site';
  const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };
  const groundBlend = { transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false };

  // ---------------- ground: wide plane (240 km) + detailed site plane (4 km) ----------------
  const fadeEdges = (g, w, h, d) => {
    g.globalCompositeOperation = 'destination-out';
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, d, 0, 0, 0, d, h], [w, 0, w - d, 0, w - d, 0, d, h], [0, 0, 0, d, 0, 0, w, d], [0, h, 0, h - d, 0, h - d, w, d]]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    }
    g.globalCompositeOperation = 'source-over';
  };
  const wideT = ctex(1024, 1024, (g, w, h) => {
    const k = w / 240000, X = x => (x + 120000) * k;
    g.fillStyle = LAND; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, rad = 6 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = ['77,106,67', '111,132,87', '122,127,85', '86,111,74', '138,138,98'][(r() * 5) | 0];
      gr.addColorStop(0, `rgba(${c},${.18 + r() * .25})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.fillStyle = '#2a6078';
    for (const [x0, wd] of [[-9500, 4200], [-21000, 5200], [-41000, 2600]]) {
      g.beginPath();
      for (let y = 0; y <= h; y += 16) g.lineTo(X(x0 + Math.sin(y * .021) * 2500 + Math.sin(y * .0063) * 4000), y);
      for (let y = h; y >= 0; y -= 16) g.lineTo(X(x0 + wd + Math.sin(y * .017 + 1) * 2200 + Math.sin(y * .0063) * 4000), y);
      g.fill();
    }
    // coast: straight beside the launch site, wandering further north and south
    const coast = z => 1000 + smooth(3500, 22000, Math.abs(z)) * (Math.sin(z / 9000) * 5000 + Math.sin(z / 23000 + 1) * 9000 - Math.abs(z) * .06);
    const Zw = py => py / k - 120000;
    const gr = g.createLinearGradient(X(1000), 0, X(9000), 0); gr.addColorStop(0, '#2f7f9c'); gr.addColorStop(1, SEA);
    g.fillStyle = '#d8cfae'; g.beginPath(); g.moveTo(w, 0);
    for (let y = 0; y <= h; y += 4) g.lineTo(X(coast(Zw(y))) - 1.6, y);
    g.lineTo(w, h); g.fill();
    g.fillStyle = gr; g.beginPath(); g.moveTo(w, 0);
    for (let y = 0; y <= h; y += 4) g.lineTo(X(coast(Zw(y))), y);
    g.lineTo(w, h); g.fill();
    fadeEdges(g, w, h, 150);
  }, { aniso: 8 });
  const wide = at(new THREE.PlaneGeometry(240000, 240000), S({ map: wideT, roughness: 1, ...groundBlend }), 0, -.5, 0, -Math.PI / 2);
  wide.renderOrder = -6; site.add(wide);

  const H = 2048, TS = 2048, kk = TS / (2 * H), X = x => (x + H) * kk;
  const siteT = ctex(TS, TS, (g, w, h) => {
    g.fillStyle = LAND; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 26000, r, ['#4d6a43', '#6f8457', '#7a7f55', '#566f4a', '#86895f', '#48603c'], .08, .3, 2, 14);
    // lagoons
    for (const [col, pad] of [['#77896a', 5], ['#3f7488', 1.5], ['#2d6480', -2]])
      for (const [cx, cz, rx, rz] of LAGOONS) { g.fillStyle = col; g.beginPath(); g.ellipse(X(cx), X(cz), Math.max(1, rx * kk + pad), Math.max(1, rz * kk + pad), 0, 0, TAU); g.fill(); }
    // ocean + beach
    g.fillStyle = '#d8cfae'; g.fillRect(X(905), 0, X(950) - X(905) + 22, h);
    const gr = g.createLinearGradient(X(950), 0, X(2048), 0); gr.addColorStop(0, '#4a9db4'); gr.addColorStop(.2, '#2f7f9c'); gr.addColorStop(1, '#2e7c9a');
    g.fillStyle = gr; g.fillRect(X(950), 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(952), 0); g.lineTo(X(952), h); g.stroke();
    // roads
    g.strokeStyle = '#74777a'; g.lineWidth = 4.5; g.lineCap = 'round';
    g.beginPath(); g.arc(X(0), X(20), 430 * kk, 0, TAU); g.stroke();
    const road = pts => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z)))); g.stroke(); };
    road([[70, 440], [70, 1840]]); road([[70, 1560], [-330, 1590], [-470, 1560]]); road([[-430, 20], [-1100, 60], [-2048, 20]]);
    road([[300, -290], [430, -340]]); road([[-300, -290], [-430, -340]]); road([[430, 20], [880, 40], [900, 2048]]);
    // pad apron
    g.fillStyle = '#a5a299'; g.fillRect(X(-175), X(-185), 350 * kk, 440 * kk);
    speckle(g, w, h, 0, r, ['#000']);
    g.fillStyle = '#8f8c84'; g.fillRect(X(-9), X(-150), 18 * kk, 380 * kk);
    const sc = g.createRadialGradient(X(0), X(0), 2, X(0), X(0), 70 * kk); sc.addColorStop(0, 'rgba(30,26,22,.75)'); sc.addColorStop(1, 'rgba(30,26,22,0)');
    g.fillStyle = sc; g.fillRect(X(-9), X(-150), 18 * kk, 380 * kk);
    // crawlerway: two river-rock tracks with a grass median
    for (const x0 of [-20, 7]) {
      g.fillStyle = '#cdbf9c'; g.fillRect(X(x0), X(225), 13 * kk, (1880 - 225) * kk);
    }
    speckle(g, w, h, 0, r, ['#000']);
    for (let i = 0; i < 9000; i++) { g.globalAlpha = .25; g.fillStyle = r() < .5 ? '#b3a37f' : '#e0d5b8'; const side = r() < .5 ? -20 : 7; g.fillRect(X(side + r() * 13), X(225 + r() * 1655), 1.2, 1.2); }
    g.globalAlpha = 1;
    // press site + VAB apron
    g.fillStyle = '#6f8f58'; g.beginPath(); g.ellipse(X(-410), X(1470), 110 * kk, 70 * kk, 0, 0, TAU); g.fill();
    g.fillStyle = '#9a9c9c'; g.fillRect(X(-560), X(1540), 110 * kk, 46 * kk);
    g.fillStyle = '#b7b4ab'; g.fillRect(X(-260), X(1850), 420 * kk, 200 * kk);
    fadeEdges(g, w, h, 60);
  }, { aniso: 16 });
  const sitePlane = at(new THREE.PlaneGeometry(2 * H, 2 * H), S({ map: siteT, roughness: 1, ...groundBlend }), 0, 0, 0, -Math.PI / 2);
  sitePlane.renderOrder = -5; sitePlane.receiveShadow = true; site.add(sitePlane);

  // ---------------- pad mound, flame trench, deflector ----------------
  const concT = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#a19e95'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2500, r, ['#8a877f', '#b3b0a7', '#7d7a73'], .08, .25, 1, 5);
    g.strokeStyle = 'rgba(70,68,62,.5)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  }, { repeat: [1, 1] });
  const conc = S({ map: concT, roughness: .95 });
  const concDark = S({ color: 0x6f6d68, roughness: .9 });
  for (const s of [-1, 1]) {
    const a = s < 0 ? [-120, -9] : [9, 120], t = s < 0 ? [-70, -9] : [9, 70];
    site.add(sh(new THREE.Mesh(hexa([a[0], a[1], -140, 230], [t[0], t[1], -100, 60, PAD_Y]), conc)));
  }
  site.add(sh(new THREE.Mesh(hexa([-9, 9, -15, 15], [-9, 9, -.4, .4, 10.5]), concDark)));
  const fixed = new Batch('box');
  for (const x of [-19.5, 19.5]) for (const z of [-24, -7, 10]) fixed.box(x, PAD_Y + 3.2, z, 3, 6.4, 3);
  for (const [x, z] of [[-62, -90], [62, -90], [-62, 50], [62, 50], [-62, -20], [62, -20]]) { fixed.beam([x, PAD_Y, z], [x, PAD_Y + 32, z], .4); fixed.box(x, PAD_Y + 32.6, z, 4.5, 1.6, .7, Math.atan2(-x, -z)); }

  // ---------------- mobile launcher ----------------
  const ml = new THREE.Group(); ml.name = 'ml'; site.add(ml);
  const steel = S({ color: 0xb4b8ba, roughness: .6, metalness: .45 });
  const steelDark = S({ color: 0x6e7376, roughness: .7, metalness: .4 });
  const mlBase = S({ color: 0x9a9fa2, roughness: .7, metalness: .3 });
  const deck = new Batch('box');
  deck.box(-15.25, 22.2, -7, 11.5, 7.6, 44).box(15.25, 22.2, -7, 11.5, 7.6, 44).box(0, 22.2, -17, 19, 7.6, 24).box(0, 22.2, 10, 19, 7.6, 10);
  for (const s of [-1, 1]) for (const dx of [-1.9, 1.9]) {
    deck.box(s * 6.4 + dx, 25.4, 0, .8, 1.2, 10);
    for (const z of [-1.75, 1.75]) deck.box(s * 6.4 + dx, 26.5, z, .7, 1.0, .7);
  }
  for (let i = 0; i < 7; i++) deck.box(-20.6, 26.6, -27 + i * 6.6, .2, 1.2, .2).box(20.6, 26.6, -27 + i * 6.6, .2, 1.2, .2);
  deck.box(-20.6, 27.2, -7, .12, .12, 44).box(20.6, 27.2, -7, .12, .12, 44).box(0, 27.2, 14.8, 41, .12, .12);
  ml.add(deck.build(mlBase));
  const tw = new Batch('box'), fl = new Batch('box'), pp = new Batch('cyl');
  truss(tw, { cx: 0, cz: -17, w: 12, d: 12, y0: DECK_TOP, y1: 134, bay: 6, col: .9, brace: .35 });
  for (let y = DECK_TOP + 6; y <= 134; y += 6) fl.box(0, y, -17, 11.4, .22, 11.4);
  fl.box(0, 134.4, -17, 13.5, .5, 13.5);
  tw.box(3.3, 80, -20.4, 3.4, 108, 3.4);
  for (let i = 0; i < 18; i++) { const y = DECK_TOP + i * 6; tw.beam([-6.35, y, i % 2 ? -12.5 : -21.5], [-6.35, y + 6, i % 2 ? -21.5 : -12.5], .9, .14); }
  for (const [x, z, rr] of [[-4.6, -11.2, .5], [-3.4, -11.2, .35], [4.8, -11.2, .5], [3.7, -11.2, .3], [2.9, -11.2, .3]]) pp.beam([x, DECK_TOP, z], [x, 118, z], rr);
  tw.beam([0, 134, -17], [0, 153, -17], .4);
  tw.box(0, 137, -17, 3, 5, 3);
  ml.add(tw.build(steel), fl.build(steelDark), pp.build(S({ color: 0xd9d9d6, roughness: .5, metalness: .4 })));

  // umbilical arms (swing away at liftoff)
  const arms = [];
  const mkArm = (y, len, o = {}) => {
    const g = new THREE.Group(); g.position.set(o.px ?? 0, y, o.pz ?? -11); ml.add(g);
    const b = new Batch('box'), hw = o.hw ?? 1.0, hh = o.hh ?? .9;
    for (const sx of [-hw, hw]) for (const sy of [-hh, hh]) b.beam([sx, sy, 0], [sx, sy, len], .22);
    const n = Math.max(2, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const z = len * i / n;
      b.beam([-hw, -hh, z], [hw, -hh, z], .16).beam([-hw, hh, z], [hw, hh, z], .16).beam([-hw, -hh, z], [-hw, hh, z], .16).beam([hw, -hh, z], [hw, hh, z], .16);
      if (i < n) { const z2 = len * (i + 1) / n; b.beam([-hw, -hh, z], [-hw, hh, z2], .12).beam([hw, hh, z], [hw, -hh, z2], .12).beam([-hw, hh, z], [hw, hh, z2], .12); }
    }
    b.box(0, 0, len - .15, hw * 2 + .5, hh * 2 + .5, .35);
    g.add(b.build(steel));
    const p = new Batch('cyl'); for (const dx of [-.45, 0, .45]) p.beam([dx, -hh + .3, 0], [dx, -hh + .3, len - .3], .22);
    g.add(p.build(steelDark));
    const a = { g, rest: o.rest ?? 0, away: o.away ?? 78 * DEG };
    g.rotation.y = a.rest; arms.push(a); return a;
  };
  mkArm(ROCKET_BASE + 62.6, 11 - 4.4);       // core forward skirt
  mkArm(ROCKET_BASE + 50.2, 11 - 4.4);       // core intertank
  mkArm(ROCKET_BASE + 74.2, 11 - 2.8);       // upper stage
  mkArm(ROCKET_BASE + 81.0, 11 - 2.95);      // service module
  // crew access arm with white room
  const caRest = Math.atan2(5, 11.5 - 4.6), caLen = Math.hypot(5, 11.5 - 4.6);
  const crewArm = mkArm(ROCKET_BASE + 84.7, caLen - 1.2, { px: -5, pz: -11.5, hw: 1.1, hh: 1.3, rest: caRest, away: caRest - 82 * DEG });
  arms.pop();
  const white = S({ color: 0xf0efea, roughness: .5 });
  crewArm.g.add(sh(at(new THREE.BoxGeometry(2.0, 2.4, caLen - 1.6), white, 0, .1, (caLen - 1.6) / 2)));
  crewArm.g.add(sh(at(new THREE.BoxGeometry(3.2, 3.2, 2.6), white, 0, .2, caLen - 2.4)));
  // tail service masts
  const masts = [];
  for (const x of [-2.7, 2.7]) {
    const g = new THREE.Group(); g.position.set(x, DECK_TOP, -8.2); ml.add(g);
    g.add(sh(at(new THREE.BoxGeometry(2.3, 10, 2.4), mlBase, 0, 5, 0)), at(new THREE.BoxGeometry(1.6, 1.8, 2.6), steelDark, 0, 7.4, 2.2));
    masts.push(g);
  }

  // ---------------- crawler-transporter ----------------
  const crawler = new THREE.Group(); crawler.name = 'crawler'; site.add(crawler);
  {
    const body = new Batch('box'), belt = new Batch('box'), wheel = new Batch('cyl');
    body.box(0, 5.3, 0, 34, 2.2, 34);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * 12.5, cz = sz * 11.5;
      body.box(cx, 3.4, cz, 7.0, 1.6, 8.5);
      for (const dx of [-2.0, 2.0]) {
        belt.box(cx + dx, 1.4, cz, 2.7, 2.8, 9.6);
        for (const e of [-4.8, 4.8]) wheel.beam([cx + dx - 1.35, 1.4, cz + e], [cx + dx + 1.35, 1.4, cz + e], 2.8);
      }
      body.box(sx * 15.4, 5.6, sz * 16.2, 2.8, 2.4, 2.6);
      for (const [px, pz] of [[sx * 14, sz * 14], [sx * 14, sz * 6], [sx * 6, sz * 14]]) wheel.beam([px, 6.4, pz], [px, 6.9, pz], 1.6);
    }
    crawler.add(body.build(S({ color: 0x9c978b, roughness: .8, metalness: .2 })), belt.build(S({ color: 0x3a3a3c, roughness: .9 })), wheel.build(S({ color: 0x4a4b4e, roughness: .8, metalness: .3 })));
  }

  // ---------------- lightning protection towers ----------------
  const LT = [[-150, 110], [165, 95], [70, -195]];
  const lt = new Batch('box'), mastB = new Batch('cyl');
  for (const [cx, cz] of LT) {
    const leg = (k, y) => { const w = lerp(9.5, 1.8, y / 150), a = (90 + k * 120) * DEG; return [cx + w * Math.cos(a), y, cz + w * Math.sin(a)]; };
    const nb = 14;
    for (let i = 0; i < nb; i++) {
      const y0 = 150 * i / nb, y1 = 150 * (i + 1) / nb;
      for (let k = 0; k < 3; k++) {
        lt.beam(leg(k, y0), leg(k, y1), .7);
        lt.beam(leg(k, y1), leg((k + 1) % 3, y1), .35);
        lt.beam(i % 2 ? leg(k, y0) : leg((k + 1) % 3, y0), i % 2 ? leg((k + 1) % 3, y1) : leg(k, y1), .3);
      }
    }
    mastB.beam([cx, 150, cz], [cx, 181, cz], 1.0);
  }
  site.add(lt.build(S({ color: 0xa7acae, roughness: .6, metalness: .5 })), mastB.build(S({ color: 0xe9e8e2, roughness: .5 })));
  {
    const pts = [];
    const cat = (a, b, sag) => { for (let i = 0; i < 16; i++) { const t0 = i / 16, t1 = (i + 1) / 16; for (const t of [t0, t1]) pts.push(new THREE.Vector3(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t))); } };
    for (let k = 0; k < 3; k++) {
      const [ax, az] = LT[k], [bx, bz] = LT[(k + 1) % 3];
      cat([ax, 180, az], [bx, 180, bz], 14);
      const out = new THREE.Vector2(ax, az - 10).normalize();
      cat([ax, 180, az], [ax + out.x * 150, 0, az + out.y * 150], 6);
    }
    site.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9aa0a4 })));
  }

  // ---------------- water tower, storage spheres, pipes, buildings ----------------
  const whiteM = S({ color: 0xf1f0ea, roughness: .45 });
  {
    const g = new THREE.Group(); g.position.set(190, 0, -150); site.add(g);
    const prof = [[1.6, 58], [10, 65], [10, 80], ...dome(10, 80, 6, true, 8).slice(1)];
    g.add(sh(new THREE.Mesh(revolve(prof, { segs: 40 }), whiteM)));
    const b = new Batch('cyl');
    for (let k = 0; k < 8; k++) { const a = k * 45 * DEG; b.beam([12 * Math.sin(a), 0, 12 * Math.cos(a)], [9.6 * Math.sin(a), 65, 9.6 * Math.cos(a)], .8); b.beam([11 * Math.sin(a), 30, 11 * Math.cos(a)], [10.7 * Math.sin(a + 45 * DEG), 38, 10.7 * Math.cos(a + 45 * DEG)], .3); }
    b.beam([0, 0, 0], [0, 60, 0], 3.2);
    g.add(b.build(whiteM));
  }
  const pipes = new Batch('cyl');
  for (const [x, z, R] of [[430, -380, 11], [-430, -380, 9]]) {
    site.add(sh(at(new THREE.SphereGeometry(R, 40, 28), whiteM, x, R + 3, z)));
    for (let k = 0; k < 10; k++) { const a = k * 36 * DEG; pipes.beam([x + R * .85 * Math.sin(a), 0, z + R * .85 * Math.cos(a)], [x + R * .85 * Math.sin(a), R + 2, z + R * .85 * Math.cos(a)], .7); }
    fixed.box(x + (x > 0 ? -20 : 20), 3, z + 14, 12, 6, 9);
    const s = Math.sign(x);
    pipes.beam([x - s * R, 2, z + 4], [s * 150, 2, -135], .7).beam([s * 150, 2, -135], [s * 60, PAD_Y + .6, -95], .7).beam([s * 60, PAD_Y + .6, -95], [s * 13, PAD_Y + .6, -31], .7).beam([s * 13, PAD_Y + .6, -31], [s * 13, 18.4, -31], .7);
  }
  pipes.beam([190, 2, -150], [112, 2, -124], 1.5).beam([112, 2, -124], [56, PAD_Y + .9, -92], 1.5).beam([56, PAD_Y + .9, -92], [17, PAD_Y + .9, -33], 1.5);
  site.add(pipes.build(S({ color: 0xd8d8d2, roughness: .5, metalness: .3 })));
  for (const [x, y, z, sx, sy, sz] of [[-250, 4, 150, 40, 8, 20], [260, 3, 205, 30, 6, 18], [-300, 3, -120, 24, 6, 24], [330, 2.5, -60, 18, 5, 14], [-90, PAD_Y + 2, -85, 10, 4, 8], [-235, 13, 1930, 120, 26, 46]])
    fixed.box(x, y, z, sx, sy, sz);
  site.add(fixed.build(S({ color: 0xc9c7bf, roughness: .85 })));

  // Vehicle Assembly Building
  {
    const rib = (door) => ctex(512, 512, (g, w, h) => {
      g.fillStyle = '#d6d8d8'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,125,128,.35)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h);
      g.fillStyle = '#3f4447'; g.fillRect(0, h - 40, w, 40);
      if (door) {
        const dx = .215 * w, dw = .16 * w;
        g.fillStyle = '#5b6266'; g.fillRect(dx - dw / 2, h * .12, dw, h * .88);
        g.strokeStyle = '#3c4145'; g.lineWidth = 3; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(dx - dw / 2, h * (.12 + .11 * i)); g.lineTo(dx + dw / 2, h * (.12 + .11 * i)); g.stroke(); }
        g.fillStyle = '#1d4fa3'; g.beginPath(); g.arc(.72 * w, .3 * h, 62, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.font = '900 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NASA', .72 * w, .3 * h);
        for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#b22234'; g.fillRect(.42 * w, .14 * h + i * 11, 110, 11); }
        g.fillStyle = '#3c3b6e'; g.fillRect(.42 * w, .14 * h, 46, 77);
      }
    }, { aniso: 8 });
    const plain = S({ map: rib(false), roughness: .8 }), front = S({ map: rib(true), roughness: .8 });
    site.add(sh(at(new THREE.BoxGeometry(158, 160, 218), [plain, plain, plain, plain, plain, front], -45, 80, 1990)));
  }

  // ---------------- press site: countdown clock, flag, spectators ----------------
  const SP = new THREE.Vector3(-420, 0, 1500);
  const dir = new THREE.Vector3(-SP.x, 0, -SP.z).normalize(), right = new THREE.Vector3(-dir.z, 0, dir.x);
  const P = (f, rt, y = 0) => SP.clone().addScaledVector(dir, f).addScaledVector(right, rt).setY(y);
  const clockC = document.createElement('canvas'); clockC.width = 512; clockC.height = 128;
  const clockT = new THREE.CanvasTexture(clockC); clockT.colorSpace = THREE.SRGBColorSpace;
  function setClock(txt) {
    const g = clockC.getContext('2d');
    g.fillStyle = '#080808'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#ff9a1f'; g.font = 'bold 76px Menlo,Courier,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, 256, 68); clockT.needsUpdate = true;
  }
  setClock('T- 00:10');
  {
    const g = new THREE.Group(); g.position.copy(P(24, -8)); g.rotation.y = Math.atan2(-dir.x, -dir.z); site.add(g);
    g.add(sh(at(new THREE.BoxGeometry(7.9, 2.0, .5), S({ color: 0x1a1a1a, roughness: .6 }), 0, 2.5, 0)));
    g.add(at(new THREE.PlaneGeometry(7.5, 1.7), new THREE.MeshBasicMaterial({ map: clockT, toneMapped: false }), 0, 2.5, .26));
    for (const x of [-3, 3]) g.add(at(new THREE.BoxGeometry(.3, 1.6, .3), S({ color: 0x555555 }), x, .8, 0));
    const fp = P(30, 15);
    site.add(sh(at(new THREE.CylinderGeometry(.14, .2, 24, 8), whiteM, fp.x, 12, fp.z)));
    const flagT = ctex(256, 128, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#fff' : '#b22234'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * .42, h * 7 / 13); });
    const flag = at(new THREE.PlaneGeometry(6, 3.4, 12, 1), S({ map: flagT, roughness: .8, side: THREE.DoubleSide }), fp.x + 3.1 * right.x, 22, fp.z + 3.1 * right.z, 0, Math.atan2(-dir.x, -dir.z));
    site.add(flag); site.userData.flag = flag;
    const cap = new THREE.CapsuleGeometry(.24, .95, 4, 10), head = new THREE.SphereGeometry(.17, 12, 10);
    const cols = [0x2d5fa8, 0xc0392b, 0xf1c40f, 0x2e8b57, 0xffffff, 0x8e44ad, 0xe67e22, 0x34495e];
    for (let i = 0; i < 9; i++) {
      const p = P(6 + r() * 6, -7 + i * 1.7 + r(), 0), kid = i % 4 === 3 ? .62 : 1;
      site.add(sh(at(cap, S({ color: cols[i % cols.length], roughness: .9 }), p.x, .78 * kid, p.z)).translateY(0));
      const b = site.children[site.children.length - 1]; b.scale.setScalar(kid);
      site.add(at(head, S({ color: 0xd9a57b, roughness: .8 }), p.x, 1.62 * kid, p.z));
    }
  }

  // ---------------- scrub / trees ----------------
  {
    const N = 1500, geo = new THREE.IcosahedronGeometry(1, 1), im = new THREE.InstancedMesh(geo, S({ roughness: 1 }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let n = 0, guard = 0;
    while (n < N && guard++ < 20000) {
      const x = (r() - .5) * 3800, z = (r() - .5) * 3800;
      if (isWater(x, z) || x > 890 || Math.abs(x) < 48 || (Math.abs(x) < 185 && z > -195 && z < 265)) continue;
      if (Math.hypot(x, z - 20) > 418 && Math.hypot(x, z - 20) < 442) continue;
      const d = new THREE.Vector3(x - SP.x, 0, z - SP.z);
      if (d.length() < 150 && d.dot(dir) > -20) continue;
      if (x > -280 && x < 170 && z > 1830) continue;
      const w = 2 + r() * 3.5, h = 1.6 + r() * 3.2;
      m.compose(new THREE.Vector3(x, h * .45, z), q.setFromEuler(new THREE.Euler(0, r() * TAU, 0)), new THREE.Vector3(w, h, w * (0.7 + r() * .6)));
      im.setMatrixAt(n, m); im.setColorAt(n, c.setHSL(.26 + r() * .07, .4 + r() * .2, .07 + r() * .07)); n++;
    }
    im.count = n; im.castShadow = true; im.receiveShadow = true; site.add(im);
  }

  // ---------------- splashdown zone: sea surface + recovery ship ----------------
  const SPLASH = new THREE.Vector3(5200, 0, 600);
  const waveT = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.globalAlpha = .12 + r() * .2; g.fillStyle = r() < .5 ? '#fff' : '#000'; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 22, 1.5 + r() * 4, 0, 0, TAU); g.fill(); }
  }, { linear: true, repeat: [220, 220] });
  const seaA = ctex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { linear: true });
  const sea = at(new THREE.PlaneGeometry(7000, 7000), S({ color: 0x1d5a86, roughness: .42, metalness: .05, bumpMap: waveT, bumpScale: 2.2, alphaMap: seaA, ...groundBlend, depthWrite: true }), SPLASH.x, .3, SPLASH.z, -Math.PI / 2);
  sea.renderOrder = -4; sea.receiveShadow = true; site.add(sea);
  {
    const b = new Batch('box');
    b.box(0, 2.2, 0, 74, 7, 13).box(-8, 8.5, 0, 26, 6, 11).box(-12, 13.5, 0, 12, 4, 8).box(-12, 18, 0, 1, 6, 1).box(22, 6.2, 0, 22, 1, 13);
    const ship = b.build(S({ color: 0x8e979d, roughness: .7, metalness: .3 })); ship.position.set(SPLASH.x + 150, 0, SPLASH.z - 90); ship.rotation.y = .5; site.add(ship);
  }

  let tAcc = 0;
  function update(dt) {
    tAcc += dt;
    waveT.offset.set(tAcc * .012, tAcc * .02);
    const f = site.userData.flag, p = f.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 1.6 + tAcc * 4) * .18 * ((x + 3) / 6)); }
    p.needsUpdate = true;
  }

  return {
    group: site, ml, crawler, arms, crewArm, masts, setClock, update, SPLASH,
    spectator: { pos: SP.clone().setY(2.6), dir },
    setArm: (a, p) => { a.g.rotation.y = lerp(a.rest, a.away, ease(p)); },
  };
}
