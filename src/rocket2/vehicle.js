// SLS Block 1 + Orion, 1 unit = 1 metre. Rocket origin = base centre (RS-25 nozzle exit plane), +Y up.
import * as THREE from 'three';
import { TAU, WEDGE, DEG, rng, revolve, dome, shellPoly, ctex, speckle, rod, pipe, merged, at, lerp, ease, clamp } from './util.js';

export const K = {
  SRB_X: 6.4, TOP: 98.3, CM_BASE: 83.3,
  RS25: [[1.72, 1.72], [-1.72, 1.72], [-1.72, -1.72], [1.72, -1.72]],
  SRB_NOZZLE_Y: -0.9, RL10_Y: 65.0, AJ10_Y: 78.4, LAS_NOZZLE_Y: 90.0,
  CABIN_EYE: [0, 85.12, -1.12], CABIN_LOOK: [0, 84.9, 1.2],
};

function materials() {
  const r = rng(11);
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const M = {};
  const foamT = ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#c56b2c'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 9000, r, ['#8a3f12', '#e08a45', '#a8521c', '#d9783a'], .03, .12, 1, 6);
    for (let i = 0; i < 140; i++) { g.globalAlpha = .05; g.fillStyle = r() < .5 ? '#7a3a10' : '#eaa060'; g.fillRect(r() * w, 0, 1 + r() * 3, h); }
    g.globalAlpha = .25; g.fillStyle = '#6b3410';
    for (const k of [0, .25, .5, .75]) g.fillRect(0, k * h, w, 3);
    g.globalAlpha = 1;
  }, { repeat: [2, 1] });
  M.foam = S({ map: foamT, roughness: .93 });
  M.foamCut = S({ color: 0xe2a877, roughness: .9, side: THREE.DoubleSide });
  M.primer = S({ color: 0x93a074, roughness: .55, metalness: .35 });
  const ribT = ctex(64, 64, (g, w, h) => {
    g.fillStyle = '#b9602a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8f4418'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h);
    g.fillStyle = '#d8854a'; for (let x = 8; x < w; x += 16) g.fillRect(x, 0, 3, h);
  }, { repeat: [27, 1] });
  M.ribbed = S({ map: ribT, roughness: .9 });
  M.white = S({ color: 0xeceae4, roughness: .55 });
  M.whiteD = S({ color: 0xeceae4, roughness: .55, side: THREE.DoubleSide });
  M.section = S({ color: 0xd9d3c5, roughness: .8, side: THREE.DoubleSide });
  M.alu = S({ color: 0xb9c0c4, roughness: .35, metalness: .8 });
  M.aluD = S({ color: 0xb9c0c4, roughness: .4, metalness: .75, side: THREE.DoubleSide });
  M.dark = S({ color: 0x2b2d31, roughness: .7 });
  M.grey = S({ color: 0x8b9096, roughness: .6, metalness: .3 });
  M.greyD = S({ color: 0x8b9096, roughness: .6, metalness: .3, side: THREE.DoubleSide });
  M.nozzle = S({ color: 0x655c55, roughness: .42, metalness: .78, side: THREE.DoubleSide });
  M.nozzleDark = S({ color: 0x35312f, roughness: .6, metalness: .5, side: THREE.DoubleSide });
  M.blanket = S({ color: 0xcfa36a, roughness: .95, side: THREE.DoubleSide });

  const srbT = ctex(1024, 2048, (g, w, h) => {
    g.fillStyle = '#efeeea'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, r, ['#d8d6cf', '#ffffff', '#cfcdc6'], .05, .15, 2, 10);
    const Y = y => h - (y / 54.3) * h;
    g.fillStyle = '#c9c7c0';
    for (const y of [12.9, 21.6, 30.3, 39.0]) g.fillRect(0, Y(y) - 6, w, 12);
    g.fillStyle = '#dcdad4';
    for (const y of [8.5, 17.2, 25.9, 34.6, 43.2]) g.fillRect(0, Y(y) - 2, w, 4);
    g.fillStyle = '#26282b'; g.fillRect(0, Y(46.5) - 5, w, 10); g.fillRect(0, Y(3.9) - 5, w, 10);
    // photogrammetry squares
    for (const [u, y] of [[.2, 44], [.7, 44], [.45, 10], [.95, 10]]) {
      const s = 26, x0 = u * w, y0 = Y(y);
      g.fillStyle = '#111'; g.fillRect(x0, y0, s, s); g.fillRect(x0 + s, y0 + s, s, s);
      g.fillStyle = '#fff'; g.fillRect(x0 + s, y0, s, s); g.fillRect(x0, y0 + s, s, s);
    }
    // NASA worm-style lettering, reading bottom to top
    g.save(); g.translate(.903 * w, Y(27)); g.rotate(-Math.PI / 2);
    g.fillStyle = '#cf2027'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 150px "Arial Rounded MT Bold","Helvetica Neue",Arial,sans-serif';
    g.fillText('N A S A', 0, 0); g.restore();
  }, { aniso: 8 });
  M.srb = S({ map: srbT, roughness: .5 });
  M.prop = S({ color: 0x8a8378, roughness: .95 });
  M.propCut = S({ color: 0xaaa193, roughness: .95, side: THREE.DoubleSide });
  M.lox = S({ color: 0x4f9fe8, roughness: .25, metalness: .1 });
  M.loxCut = S({ color: 0x8cc8ff, roughness: .35, side: THREE.DoubleSide });
  M.lh2 = S({ color: 0xe8606e, roughness: .25, metalness: .1 });
  M.lh2Cut = S({ color: 0xffa2aa, roughness: .35, side: THREE.DoubleSide });
  M.heat = S({ color: 0x6a5645, roughness: .95 });
  M.heatCut = S({ color: 0x9a826a, roughness: .95, side: THREE.DoubleSide });
  M.suit = S({ color: 0xe8691c, roughness: .8 });
  M.helmet = S({ color: 0xf2f2f0, roughness: .35 });
  M.visor = S({ color: 0x16202c, roughness: .15, metalness: .6 });
  M.seat = S({ color: 0x3b4149, roughness: .8 });
  M.red = S({ color: 0xb0302a, roughness: .7 });

  const solarT = ctex(128, 128, (g, w, h) => {
    g.fillStyle = '#12224a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5f78b8'; g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); }
  });
  M.solar = S({ map: solarT, roughness: .3, metalness: .4 });

  const fairT = ctex(1024, 256, (g, w, h) => {
    g.fillStyle = '#edebe5'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c8c6bf'; g.lineWidth = 2;
    for (const u of [0, 1 / 3, 2 / 3]) { g.beginPath(); g.moveTo(u * w + 1, 0); g.lineTo(u * w + 1, h); g.stroke(); }
    const cx = .93 * w, cy = .45 * h;
    g.fillStyle = '#1d4fa3'; g.beginPath(); g.arc(cx, cy, 44, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.font = '900 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NASA', cx, cy);
    g.strokeStyle = '#d8262c'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 46, cy + 22); g.quadraticCurveTo(cx, cy - 6, cx + 48, cy - 30); g.stroke();
    g.fillStyle = '#1b2f6e'; g.font = '900 34px Arial'; g.fillText('ARTEMIS', .8 * w, cy);
  });
  M.fairing = S({ map: fairT, roughness: .5 });

  const winA = ctex(1024, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#000';
    const V = y => (1 - (y - 83.6) / (86.55 - 83.6)) * h;
    for (const [deg, hw, ya, yb] of [[335, 7, 84.75, 85.35], [25, 7, 84.75, 85.35], [292, 4.5, 84.8, 85.2], [68, 4.5, 84.8, 85.2]]) {
      const x = deg / 360 * w, dx = hw / 360 * w;
      g.beginPath(); g.roundRect(x - dx, V(yb), dx * 2, V(ya) - V(yb), 6); g.fill();
    }
  }, { linear: true });
  M.cmOuter = S({ color: 0xc4c8cc, roughness: .32, metalness: .65, alphaMap: winA, alphaTest: .5 });
  M.cmInner = S({ color: 0xd6d8d6, roughness: .8, alphaMap: winA, alphaTest: .5 });
  M.cmFloor = S({ color: 0x77808a, roughness: .8, side: THREE.DoubleSide });
  M.icps = S({ color: 0xe6e3da, roughness: .5 });
  M.esm = S({ color: 0xd9dbdc, roughness: .45, metalness: .2 });
  return M;
}

function rs25Parts(M) {
  const R = y => 0.15 + 1.0 * Math.pow(Math.max(0, 1 - y / 3.0), 0.55);
  const bell = []; for (let i = 0; i <= 16; i++) { const y = 3.0 * i / 16; bell.push([R(y), y]); }
  const noz = [new THREE.Mesh(revolve(bell, { segs: 40 }))];
  for (const y of [.25, .7, 1.15, 1.6, 2.05, 2.5, 2.85]) noz.push(at(new THREE.TorusGeometry(R(y) + .015, .028, 6, 36), null, 0, y, 0, Math.PI / 2));
  const met = [
    new THREE.Mesh(revolve([[.15, 3.0], [.3, 3.3], [.3, 3.6], [.18, 3.85]], { segs: 20 })),
    at(new THREE.CylinderGeometry(.36, .36, .3, 20), null, 0, 3.98, 0),
    at(new THREE.CylinderGeometry(.19, .19, 1.0, 14), null, .56, 3.5, 0),
    at(new THREE.CylinderGeometry(.19, .19, 1.0, 14), null, -.56, 3.5, 0),
    at(new THREE.CylinderGeometry(.14, .14, .8, 12), null, 0, 3.45, .5),
    at(new THREE.CylinderGeometry(.14, .14, .8, 12), null, 0, 3.45, -.5),
    at(new THREE.SphereGeometry(.17, 14, 10), null, 0, 4.25, 0),
    at(new THREE.CylinderGeometry(.1, .1, .5, 10), null, 0, 4.5, 0),
    pipe([[.56, 4.0, 0], [.5, 4.3, 0], [.18, 4.2, 0]], .09, null, 10, 8),
    pipe([[-.56, 4.0, 0], [-.5, 4.3, 0], [-.18, 4.2, 0]], .09, null, 10, 8),
    pipe([[0, 3.05, .5], [0, 2.8, .7], [.0, 2.55, .52]], .06, null, 8, 6),
  ];
  return { noz: merged(noz), met: merged(met) };
}

function astronautGeo() {
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
  const suit = [
    at(cap(.19, .42), null, 0, .2, .05, Math.PI / 2),
    at(cap(.085, .3), null, .1, .42, -.3), at(cap(.085, .3), null, -.1, .42, -.3),
    at(cap(.08, .32), null, .1, .62, -.52, Math.PI / 2), at(cap(.08, .32), null, -.1, .62, -.52, Math.PI / 2),
    at(cap(.07, .42), null, .27, .2, .08, Math.PI / 2), at(cap(.07, .42), null, -.27, .2, .08, Math.PI / 2),
  ];
  const seat = [
    at(new THREE.BoxGeometry(.56, .06, 1.05), null, 0, -.02, .1),
    at(new THREE.BoxGeometry(.36, .06, .28), null, 0, .02, .58),
    at(new THREE.BoxGeometry(.56, .4, .06), null, 0, .2, -.44),
    at(new THREE.BoxGeometry(.56, .05, .42), null, 0, .5, -.62),
    at(new THREE.CylinderGeometry(.03, .03, .5, 6), null, .24, -.28, .4), at(new THREE.CylinderGeometry(.03, .03, .5, 6), null, -.24, -.28, .4),
    at(new THREE.CylinderGeometry(.03, .03, .5, 6), null, .24, -.28, -.3), at(new THREE.CylinderGeometry(.03, .03, .5, 6), null, -.24, -.28, -.3),
  ];
  return {
    suit: merged(suit), seat: merged(seat),
    helmet: new THREE.SphereGeometry(.17, 18, 14), visor: new THREE.SphereGeometry(.125, 14, 10),
  };
}

export function buildVehicle() {
  const M = materials();
  const rocket = new THREE.Group(); rocket.name = 'rocket';
  const full = [], cut = [], inner = [];
  let cutOn = false;
  const shadow = m => { m.castShadow = true; m.receiveShadow = true; return m; };

  // ---- builders: every shell exists twice (whole, and with the cutaway wedge removed) ----
  function pair(parent, poly, o) {
    const segs = o.segs || 56, a0 = o.phi ? o.phi[0] : 0, a1 = o.phi ? o.phi[1] : TAU;
    const base = { closed: true, segs, mat: o.mat, capMat: 1, v0: o.v0, v1: o.v1, smooth: o.smooth ?? 40 };
    const mf = shadow(new THREE.Mesh(revolve(poly, { ...base, phi0: a0, phi1: a1, caps: !!o.phi }), o.mats));
    parent.add(mf);
    if (a0 >= WEDGE - 1e-6) return mf;
    const mc = shadow(new THREE.Mesh(revolve(poly, { ...base, phi0: WEDGE, phi1: a1, caps: true }), o.mats));
    mc.visible = false; parent.add(mc); full.push(mf); cut.push(mc);
    return mf;
  }
  const shell = (parent, outer, t, mat, o = {}) => {
    const m = outer.length;
    return pair(parent, shellPoly(outer, t), { ...o, mat: i => (i <= m - 2 ? 0 : 2), mats: [mat, o.cap || M.section, o.inner || mat] });
  };
  const solid = (parent, poly, mat, cap, o = {}) => pair(parent, poly, { ...o, mats: [mat, cap || M.section, mat] });
  const innerSolid = (parent, poly, mat, cap, segs = 40) => {
    const m = new THREE.Mesh(revolve(poly, { closed: true, segs, phi0: WEDGE, phi1: TAU, caps: true, capMat: 1 }), [mat, cap || M.section]);
    m.visible = false; parent.add(m); inner.push(m); return m;
  };
  const innerShell = (parent, outer, t, mat, cap, segs = 40) => innerSolid(parent, shellPoly(outer, t), mat, cap, segs);
  const surf = (parent, pts, mat, o = {}) => {
    const segs = o.segs || 48;
    const mf = new THREE.Mesh(revolve(pts, { segs, v0: o.v0, v1: o.v1 }), mat);
    const mc = new THREE.Mesh(revolve(pts, { segs, phi0: WEDGE, phi1: TAU, v0: o.v0, v1: o.v1 }), mat);
    mc.visible = false; parent.add(mf, mc); full.push(mf); cut.push(mc); return mf;
  };
  const hid = (parent, m) => { m.visible = false; parent.add(m); inner.push(m); return m; };
  const ring = (parent, r, y, w, h, mat, o = {}) => solid(parent, [[r, y - h / 2], [r + w, y - h / 2], [r + w, y + h / 2], [r, y + h / 2]], mat, mat, { segs: 48, ...o });

  // ======================= CORE STAGE =======================
  const core = new THREE.Group(); core.name = 'core'; rocket.add(core);
  const fo = { v0: 0, v1: 16, inner: M.primer, cap: M.foamCut, segs: 72 };
  shell(core, [[3.85, 2.6], [4.2, 3.5], [4.2, 8.5]], .13, M.foam, fo);          // engine section + boattail
  shell(core, [[4.2, 8.5], [4.2, 47.0]], .13, M.foam, fo);                      // LH2 barrel
  shell(core, [[4.2, 47.0], [4.2, 53.6]], .15, M.ribbed, { inner: M.primer, cap: M.foamCut, segs: 72 }); // intertank
  shell(core, [[4.2, 53.6], [4.2, 61.0]], .13, M.foam, fo);                     // LOX barrel
  shell(core, [[4.2, 61.0], [4.2, 64.6]], .13, M.foam, fo);                     // forward skirt
  shell(core, [[4.2, 64.6], [2.62, 72.1]], .11, M.foam, fo);                    // LVSA (stays with the core)
  for (const y of [8.5, 47.0, 53.6, 61.0, 64.6]) ring(core, 4.2, y, .05, .22, M.foam, { v0: 0, v1: 16 });
  surf(core, [[0, 2.66], [3.85, 2.66]], M.blanket);                             // base heat shield
  // photogrammetry markers
  const chk = ctex(64, 64, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#111'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); });
  const chkM = new THREE.MeshStandardMaterial({ map: chk, roughness: .7 });
  for (const [deg, y] of [[300, 58], [345, 45.5], [200, 58], [120, 45.5], [330, 5.5], [150, 5.5]]) {
    const a = deg * DEG, m = at(new THREE.PlaneGeometry(1.1, 1.1), chkM, 4.225 * Math.sin(a), y, 4.225 * Math.cos(a), 0, a);
    core.add(m);
  }
  // tank domes (seen in cutaway)
  innerShell(core, dome(4.07, 8.5, 2.2, false), .08, M.alu);       // LH2 aft
  innerShell(core, dome(4.07, 47.0, 2.2, true), .08, M.alu);       // LH2 forward
  innerShell(core, dome(4.07, 53.6, 2.2, false), .08, M.alu);      // LOX aft
  innerShell(core, dome(4.07, 61.0, 2.2, true), .08, M.alu);       // LOX forward
  const tankPoly = (yb, yt, h, R, f) => {
    const y0 = yb - h, y1 = yt + h, yl = y0 + (y1 - y0) * clamp(f, .002, 1);
    const all = [...dome(R, yb, h, false, 10), ...dome(R, yt, h, true, 10)];
    const pts = [];
    for (let i = 0; i < all.length; i++) {
      if (all[i][1] < yl - 1e-3) { pts.push(all[i]); continue; }
      const p = all[Math.max(0, i - 1)], q = all[i], t = q[1] - p[1] > 1e-6 ? (yl - p[1]) / (q[1] - p[1]) : 0;
      const rl = lerp(p[0], q[0], t);
      if (rl > .02) pts.push([rl, yl]);
      break;
    }
    pts.push([0, yl]);
    return pts;
  };
  const TANKS = { lh2: [8.5, 47.0, 2.2, 3.97], lox: [53.6, 61.0, 2.2, 3.97] };
  const liq = {
    lh2: hid(core, new THREE.Mesh(new THREE.BufferGeometry(), [M.lh2, M.lh2Cut])),
    lox: hid(core, new THREE.Mesh(new THREE.BufferGeometry(), [M.lox, M.loxCut])),
  };
  let fuelNow = -1;
  function setFuel(f) {
    f = clamp(f, 0, 1);
    if (Math.abs(f - fuelNow) < .008 && !(f === 0 && fuelNow !== 0) && !(f === 1 && fuelNow !== 1)) return;
    fuelNow = f;
    for (const k of ['lh2', 'lox']) {
      const m = liq[k]; m.geometry.dispose();
      m.userData.empty = f < .004;
      m.geometry = m.userData.empty ? new THREE.BufferGeometry()
        : revolve(tankPoly(...TANKS[k], f), { closed: true, segs: 40, phi0: WEDGE, phi1: TAU, caps: true, capMat: 1 });
      m.visible = cutOn && !m.userData.empty;
    }
  }
  setFuel(0);
  // intertank structure
  hid(core, at(new THREE.BoxGeometry(8.0, .7, .6), M.grey, 0, 50.3, -.2));
  for (const y of [48.2, 52.4]) innerSolid(core, [[3.5, y - .12], [4.05, y - .12], [4.05, y + .12], [3.5, y + .12]], M.grey, M.grey);
  // LOX feedlines (outside the tank wall), systems tunnel, pressurisation line
  for (const deg of [320, 140]) {
    const a = deg * DEG, P = (r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
    core.add(shadow(pipe([P(2.2, 51.9), P(3.3, 51.2), P(4.5, 50.2), P(4.56, 48.6), P(4.56, 30), P(4.56, 10.2), P(4.45, 8.6), P(3.6, 7.3), P(2.6, 6.6)], .27, M.foam, 90, 10)));
    for (const y of [14, 20, 26, 32, 38, 44]) core.add(at(new THREE.BoxGeometry(.5, .25, .45), M.foam, 4.3 * Math.sin(a), y, 4.3 * Math.cos(a), 0, a));
  }
  { const a = 345 * DEG; core.add(shadow(at(new THREE.BoxGeometry(.55, 52, .26), M.foam, 4.3 * Math.sin(a), 35, 4.3 * Math.cos(a), 0, a))); }
  { const a = 305 * DEG; core.add(rod([4.3 * Math.sin(a), 9, 4.3 * Math.cos(a)], [4.3 * Math.sin(a), 62, 4.3 * Math.cos(a)], .07, M.foam, 6)); }
  // engines
  const eg = rs25Parts(M);
  for (const [x, z] of K.RS25) {
    const n = shadow(new THREE.Mesh(eg.noz, M.nozzle)), m = new THREE.Mesh(eg.met, M.alu);
    n.position.set(x, 0, z); m.position.set(x, 0, z); core.add(n, m);
    core.add(rod([x, 4.7, z], [x * 1.9, 6.6, z * 1.9], .08, M.grey, 6));
    hid(core, pipe([[x * .45, 6.5, z * .45], [x * .7, 5.6, z * .7], [x * .95, 4.5, z * .95], [x * .78, 4.05, z * .78]], .15, M.alu, 14, 8));
  }
  hid(core, at(new THREE.TorusGeometry(2.6, .2, 8, 40), M.foam, 0, 6.6, 0, Math.PI / 2));     // LOX manifold
  for (const [x, y, z] of [[2.9, 5.2, .6], [.6, 5.2, 2.9], [-2.9, 5.4, -.4]]) hid(core, at(new THREE.SphereGeometry(.55, 16, 12), M.dark, x, y, z)); // helium bottles
  for (const a of [20, 70, 200, 250]) hid(core, at(new THREE.BoxGeometry(.9, .7, .5), M.grey, 3.6 * Math.sin(a * DEG), 62.6, 3.6 * Math.cos(a * DEG), 0, a * DEG)); // avionics

  // ======================= BOOSTERS =======================
  const srbs = [];
  for (const side of [-1, 1]) {
    const b = new THREE.Group(); b.name = 'srb'; b.position.x = side * K.SRB_X; rocket.add(b);
    const so = { v0: 0, v1: 54.3, segs: 48 };
    shell(b, [[2.65, .2], [1.9, 3.9]], .1, M.srb, so);
    shell(b, [[1.86, 3.9], [1.86, 49.6]], .07, M.srb, so);
    shell(b, [[1.86, 49.6], [1.5, 51.2], [.95, 52.9], [.45, 53.9], [.18, 54.25], [0, 54.3]], .07, M.srb, { ...so, smooth: 60 });
    for (const [y, w, h] of [[12.9, .07, .3], [21.6, .07, .3], [30.3, .07, .3], [39.0, .07, .3], [6.3, .1, .22], [4.6, .06, .1], [5.4, .06, .1], [7.4, .06, .1], [46.5, .06, .2], [49.6, .05, .2], [.35, .1, .3]])
      ring(b, y < 1 ? 2.63 : 1.86, y, w, h, M.white);
    const R = y => .7 + 1.2 * Math.pow(Math.max(0, 1 - (y + .9) / 4.1), .6);
    const bell = []; for (let i = 0; i <= 14; i++) { const y = -.9 + 4.1 * i / 14; bell.push([R(y), y]); }
    b.add(shadow(new THREE.Mesh(revolve(bell, { segs: 40 }), M.nozzleDark)));
    b.add(at(new THREE.TorusGeometry(R(-.85) + .03, .07, 8, 40), M.grey, 0, -.85, 0, Math.PI / 2));
    { const a = 250 * DEG; b.add(at(new THREE.BoxGeometry(.4, 44, .2), M.white, 1.93 * Math.sin(a), 26, 1.93 * Math.cos(a), 0, a)); }
    // separation motors
    for (const a of [70, 110, 250, 290]) {
      b.add(at(new THREE.CylinderGeometry(.09, .13, .5, 8), M.dark, 1.2 * Math.sin(a * DEG), 52.2, 1.2 * Math.cos(a * DEG)));
      b.add(at(new THREE.CylinderGeometry(.09, .13, .5, 8), M.dark, 2.35 * Math.sin(a * DEG), 1.6, 2.35 * Math.cos(a * DEG)));
    }
    // attach hardware (toward the core)
    b.add(at(new THREE.BoxGeometry(.9, .9, .9), M.grey, -side * 1.95, 48.4, 0));
    for (const dz of [-1.1, 0, 1.1]) b.add(rod([-side * 1.8, 6.3, dz * .6], [-side * (K.SRB_X - 4.1), dz === 0 ? 6.3 : 5.2, dz * 1.6], .09, M.grey, 6));
    // inside: propellant segments with a centre bore, forward dome, igniter
    const segY = [[4.3, 12.7], [13.0, 21.4], [21.7, 30.1], [30.4, 38.8], [39.1, 46.2]];
    segY.forEach(([y0, y1], i) => {
      const r0 = .8 - i * .07, r1 = r0 - .07;
      innerSolid(b, [[1.76, y0], [1.76, y1], [r1, y1], [r0, y0]], M.prop, M.propCut, 36);
    });
    innerShell(b, dome(1.78, 46.4, 1.3, true, 8), .06, M.alu, M.section, 32);
    hid(b, at(new THREE.CylinderGeometry(.22, .22, 1.3, 12), M.red, 0, 46.3, 0));
    hid(b, at(new THREE.BoxGeometry(.8, .6, .5), M.grey, .5, 48.3, -.9));
    srbs.push(b);
  }

  // ======================= UPPER STAGE (ICPS) =======================
  const icps = new THREE.Group(); icps.name = 'icps'; rocket.add(icps);
  shell(icps, [[2.6, 72.1], [2.6, 76.6]], .07, M.icps);
  ring(icps, 2.6, 72.3, .04, .3, M.grey); ring(icps, 2.6, 76.4, .04, .25, M.grey);
  shell(icps, [[2.6, 76.6], [2.75, 78.1]], .07, M.white);                        // Orion stage adapter
  shell(icps, [[2.6, 78.12], [2.07, 79.5]], .06, M.grey, { inner: M.grey });     // spacecraft adapter cone
  innerShell(icps, dome(2.5, 72.3, 1.5, false, 8), .06, M.alu);
  innerShell(icps, dome(2.5, 76.3, 1.3, true, 8), .06, M.alu);
  innerSolid(icps, tankPoly(72.3, 76.3, 1.4, 2.4, .96), M.lh2, M.lh2Cut);
  icps.add(at(new THREE.SphereGeometry(1.55, 32, 20), M.alu, 0, 68.9, 0).rotateX(0));
  icps.children[icps.children.length - 1].scale.y = .8;
  for (let k = 0; k < 8; k++) {
    const a = (k + .5) * 45 * DEG, a2 = a + 22 * DEG * (k % 2 ? 1 : -1);
    icps.add(rod([2.45 * Math.sin(a), 71.6, 2.45 * Math.cos(a)], [1.35 * Math.sin(a2), 69.7, 1.35 * Math.cos(a2)], .05, M.grey, 6));
  }
  { // RL10 engine
    const R = y => .12 + .9 * Math.pow(Math.max(0, 1 - (y - 65.0) / 2.3), .6);
    const bell = []; for (let i = 0; i <= 12; i++) { const y = 65.0 + 2.3 * i / 12; bell.push([R(y), y]); }
    icps.add(new THREE.Mesh(revolve(bell, { segs: 36 }), M.nozzle));
    icps.add(at(new THREE.CylinderGeometry(.28, .2, .5, 14), M.alu, 0, 67.5, 0));
    icps.add(at(new THREE.CylinderGeometry(.12, .12, .6, 10), M.alu, .38, 67.4, 0));
    icps.add(at(new THREE.CylinderGeometry(.12, .12, .6, 10), M.alu, -.38, 67.4, 0));
    for (const a of [45, 225]) icps.add(at(new THREE.SphereGeometry(.38, 14, 10), M.dark, 2.0 * Math.sin(a * DEG), 70.6, 2.0 * Math.cos(a * DEG)));
  }

  // ======================= ORION =======================
  const orion = new THREE.Group(); orion.name = 'orion'; rocket.add(orion);
  const sm = new THREE.Group(); sm.name = 'sm'; orion.add(sm);
  const cm = new THREE.Group(); cm.name = 'cm'; orion.add(cm);

  // service module fairing panels (3), jettisoned in flight
  const fairings = [];
  const fProf = [[2.75, 78.1], [2.75, 82.6], [2.72, 83.3]];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.name = 'fairing'; rocket.add(g);
    shell(g, fProf, .06, M.fairing, { phi: [i * TAU / 3, (i + 1) * TAU / 3], inner: M.white, segs: 60 });
    g.userData.dir = new THREE.Vector3(Math.sin((i + .5) * TAU / 3), 0, Math.cos((i + .5) * TAU / 3));
    fairings.push(g);
  }
  // European service module
  shell(sm, [[2.05, 79.5], [2.05, 82.3]], .05, M.esm, { inner: M.grey });
  shell(sm, [[2.05, 82.3], [2.45, 82.9], [2.5, 83.28]], .06, M.white, { inner: M.grey });
  surf(sm, [[0, 79.55], [2.05, 79.55]], M.greyD);
  for (let k = 0; k < 4; k++) {
    const a = (45 + k * 90) * DEG;
    hid(sm, at(new THREE.CapsuleGeometry(.5, 1.1, 6, 14), M.alu, 1.05 * Math.sin(a), 80.95, 1.05 * Math.cos(a)));
  }
  for (let k = 0; k < 8; k++) { const a = k * 45 * DEG; sm.add(at(new THREE.CylinderGeometry(.06, .13, .3, 8), M.nozzle, 1.6 * Math.sin(a), 79.4, 1.6 * Math.cos(a))); }
  { // main engine
    const R = y => .1 + .52 * Math.pow(Math.max(0, 1 - (y - 78.4) / 1.2), .6);
    const bell = []; for (let i = 0; i <= 10; i++) { const y = 78.4 + 1.2 * i / 10; bell.push([R(y), y]); }
    sm.add(new THREE.Mesh(revolve(bell, { segs: 28 }), M.nozzle));
  }
  // solar array wings
  const wings = [];
  for (let k = 0; k < 4; k++) {
    const w = new THREE.Group(); w.position.set(2.1 * Math.sin((45 + k * 90) * DEG), 82.1, 2.1 * Math.cos((45 + k * 90) * DEG));
    w.rotation.y = (45 + k * 90) * DEG;
    const arm = new THREE.Group(); w.add(arm);
    arm.add(at(new THREE.BoxGeometry(.12, .9, .08), M.grey, 0, -.45, .06));
    const panels = [];
    for (let i = 0; i < 3; i++) { const p = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.0, .04), M.solar)); arm.add(p); panels.push(p); }
    sm.add(w); wings.push({ arm, panels });
  }
  function setDeploy(d) {
    for (const w of wings) {
      w.arm.rotation.x = -Math.PI / 2 * ease(Math.min(1, d * 2));
      const e = ease(Math.max(0, d * 2 - 1));
      w.panels.forEach((p, i) => p.position.set(0, lerp(-1.02, -(1.9 + i * 2.05), e), lerp(.08 + i * .07, .08, e)));
    }
  }
  setDeploy(0);

  // crew module
  solid(cm, [...Array.from({ length: 11 }, (_, i) => { const r = 2.51 * i / 10; return [r, 83.0 + .45 * (r / 2.51) ** 2]; }), [2.51, 83.6], [0, 83.6]], M.heat, M.heatCut, { segs: 56 });
  {
    const outer = [[2.51, 83.6], [1.02, 85.95], [.95, 86.0], [.95, 86.55]], m = outer.length;
    pair(cm, shellPoly(outer, .22), { segs: 64, v0: 83.6, v1: 86.55, mat: i => (i <= m - 2 ? 0 : 2), mats: [M.cmOuter, M.section, M.cmInner] });
  }
  solid(cm, [[0, 86.42], [.95, 86.42], [.95, 86.6], [0, 86.6]], M.grey, M.section, { segs: 32 });
  surf(cm, [[2.25, 83.66], [0, 83.66]], M.cmFloor);
  // window glass
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc4e8, roughness: .05, metalness: .2, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide });
  for (const deg of [335, 292]) { const a = deg * DEG; cm.add(at(new THREE.PlaneGeometry(deg === 335 ? .62 : .42, .72), glass, 1.52 * Math.sin(a), 85.05, 1.52 * Math.cos(a), 0, a).rotateX(-.565)); }
  // seats + crew
  const ag = astronautGeo();
  [[-1.3, 83.98], [-.45, 84.42], [.45, 84.42], [1.3, 83.98]].forEach(([x, y]) => {
    const g = new THREE.Group(); g.position.set(x, y, 0);
    g.add(new THREE.Mesh(ag.seat, M.seat), new THREE.Mesh(ag.suit, M.suit), at(ag.helmet, M.helmet, 0, .25, .5), at(ag.visor, M.visor, 0, .325, .535));
    cm.add(g);
  });
  // display console
  const scr = document.createElement('canvas'); scr.width = 512; scr.height = 160;
  const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace;
  const consoleG = new THREE.Group(); consoleG.position.set(0, 85.5, .55); consoleG.rotation.x = .7;
  consoleG.add(at(new THREE.BoxGeometry(1.24, .08, .46), M.dark, 0, 0, 0));
  consoleG.add(at(new THREE.PlaneGeometry(1.16, .38), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }), 0, -.045, 0, Math.PI / 2, 0, Math.PI));
  cm.add(consoleG);
  for (const [x, z] of [[-1.5, -1.0], [1.5, -1.0], [0, -1.7]]) cm.add(at(new THREE.BoxGeometry(.6, .5, .5), M.grey, x, 83.92, z));
  const cabinLight = new THREE.PointLight(0xfff1dc, 5, 6, 1.6); cabinLight.position.set(0, 85.0, -.3); cm.add(cabinLight);
  function drawScreen(d) {
    const g = scr.getContext('2d');
    g.fillStyle = '#05070b'; g.fillRect(0, 0, 512, 160);
    const box = (x, t, v, c) => {
      g.fillStyle = '#0c1a2c'; g.fillRect(x + 6, 8, 158, 144);
      g.strokeStyle = '#2f5d8f'; g.lineWidth = 2; g.strokeRect(x + 6, 8, 158, 144);
      g.fillStyle = '#7fb6ff'; g.font = 'bold 20px Menlo,monospace'; g.textAlign = 'center'; g.fillText(t, x + 85, 40);
      g.fillStyle = c; g.font = 'bold 34px Menlo,monospace'; g.fillText(v, x + 85, 96);
    };
    box(0, 'ALTITUDE', d.alt, '#6dff8f'); box(170, d.clock, d.phase, '#ffd45c'); box(340, 'SPEED', d.spd, '#6dff8f');
    g.fillStyle = '#7fb6ff'; g.font = 'bold 18px Menlo,monospace';
    g.fillText('km', 85, 128); g.fillText('km/h', 425, 128);
    scrTex.needsUpdate = true;
  }
  drawScreen({ alt: '0', spd: '0', clock: 'T-00:10', phase: 'READY' });

  // ======================= LAUNCH ABORT SYSTEM =======================
  const las = new THREE.Group(); las.name = 'las'; rocket.add(las);
  {
    const p = [];
    for (let i = 0; i <= 12; i++) { const s = i / 12; p.push([.48 + 2.3 * Math.pow(Math.cos(s * Math.PI / 2), .8), 83.3 + 6 * s]); }
    p.push([.46, 94.2], [.4, 95.6], [.36, 97.2], [.2, 97.9], [0, 98.3]);
    shell(las, p, .07, M.white, { segs: 56, smooth: 30 });
    ring(las, .46, 94.2, .04, .2, M.grey, { segs: 24 }); ring(las, .4, 95.6, .04, .16, M.grey, { segs: 24 });
    for (const a of [45, 135, 225, 315]) {
      const n = at(new THREE.CylinderGeometry(.12, .3, .9, 12), M.nozzleDark, .62 * Math.sin(a * DEG), 90.0, .62 * Math.cos(a * DEG));
      n.rotation.set(Math.cos(a * DEG) * -.42, 0, Math.sin(a * DEG) * .42); las.add(n);
      las.add(at(new THREE.CylinderGeometry(.05, .09, .3, 8), M.nozzleDark, .46 * Math.sin(a * DEG), 94.6, .46 * Math.cos(a * DEG)));
    }
    innerSolid(las, [[.37, 90.7], [.37, 94.0], [.14, 94.0], [.14, 90.7]], M.prop, M.propCut, 24);
    innerSolid(las, [[.3, 94.4], [.3, 95.4], [.1, 95.4], [.1, 94.4]], M.prop, M.propCut, 24);
  }

  // ---- parachutes (built hidden; shown during descent) ----
  const chutes = new THREE.Group(); chutes.visible = false; chutes.position.set(0, 86.6, 0); cm.add(chutes);
  const chuteT = ctex(256, 64, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f3f1ea' : '#e2531f'; g.fillRect(i * 16, 0, 16, h); } });
  const chuteM = new THREE.MeshStandardMaterial({ map: chuteT, roughness: .85, side: THREE.DoubleSide });
  const lineM = new THREE.LineBasicMaterial({ color: 0xdddddd });
  const mains = [], drogues = [];
  const mkChute = (r, height, tilt, az) => {
    const g = new THREE.Group(); g.rotation.set(0, az, 0);
    const t = new THREE.Group(); t.rotation.x = tilt; g.add(t);
    const can = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 10, 0, TAU, 0, 1.15), chuteM); can.position.y = height - r * .45; can.castShadow = true;
    const rim = r * Math.sin(1.15), ry = height - r * .45 + r * Math.cos(1.15), pts = [];
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; pts.push(new THREE.Vector3(0, 3.5, 0), new THREE.Vector3(rim * Math.sin(a), ry, rim * Math.cos(a))); }
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineM);
    t.add(can, lines); chutes.add(g);
    return { g, t };
  };
  for (let k = 0; k < 3; k++) mains.push(mkChute(8.5, 44, .27, k * TAU / 3 + .5));
  for (let k = 0; k < 2; k++) drogues.push(mkChute(2.0, 22, .2, k * Math.PI));
  chutes.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3.5, 0)]), lineM));
  function setChutes(d, m) {          // d = drogue inflation 0..1, m = main inflation 0..1
    chutes.visible = d > 0 || m > 0;
    for (const c of drogues) { c.g.visible = d > 0 && m < .25; c.t.scale.set(.25 + .75 * d, 1, .25 + .75 * d); }
    for (const c of mains) { c.g.visible = m > 0; const s = .12 + .88 * ease(m); c.t.scale.set(s, .55 + .45 * m, s); }
  }
  setChutes(0, 0);

  function setCut(on) {
    cutOn = on;
    for (const m of full) m.visible = !on;
    for (const m of cut) m.visible = on;
    for (const m of inner) m.visible = on && !m.userData.empty;
  }

  return {
    rocket, core, srbs, icps, orion, sm, cm, las, fairings, chutes, M,
    setCut, isCut: () => cutOn, setFuel, setDeploy, setChutes, drawScreen, cabinLight,
    refreshInner: () => setCut(cutOn),
  };
}
