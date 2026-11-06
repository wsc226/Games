/* ═══ ROUTE ═══
   The whole line is one centre-line built from straights and arcs, sampled
   every metre. Everything (trains, signals, stations, cameras) is positioned
   by distance along it: s (metres from Tokyo). Tracks are lateral offsets.
   heading h: 0 = north (-z), positive = turning right (east, +x).
   Ground is at y = GROUND; elevAt(s) lifts the rails (viaducts, bridges).   */
const GROUND = -.62;
const TRACK = {
  step: 1, n: 0, px: null, pz: null, ph: null, len: 0,
  gauge: 1.067,
  PLAYER: 2.0, OPP: -2.0,              // lateral offsets (left of centre-line = +)
  STATION_HALF: 230,                   // straight length each side of a station
  PLAT_HALF: 85,                       // platform half-length
  STOP_AHEAD: 42,                      // the "3" stop marker, metres past station centre
};
const CURVES = [];                     // {s0, s1, k}
const FEAT = { elev: [], rivers: [], tunnels: [], crossings: [], viaducts: [] };

function buildRoute() {
  R = mulberry(205);
  const segs = [];
  let s = 0, hNet = 0;
  const stS = [];
  STATIONS.forEach(st => {
    stS.push(s + TRACK.STATION_HALF);
    if (!st.leg) { segs.push({ len: TRACK.STATION_HALF * 2 + 400, k: 0 }); return; }
    const M = st.leg - TRACK.STATION_HALF * 2;
    const a1 = M * rr(.16, .22), a2 = M * rr(.16, .22);
    const st1 = M * rr(.2, .26), st2 = M * rr(.12, .18);
    const st3 = M - a1 - a2 - st1 - st2;
    let ang1 = rr(.22, .5) * (R() < .5 ? -1 : 1);
    if (Math.abs(hNet + ang1) > .7) ang1 = -ang1;
    let ang2 = -ang1 * rr(.5, 1.3);
    if (Math.abs(hNet + ang1 + ang2) > .6) ang2 = -(hNet + ang1) * .8;
    hNet += ang1 + ang2;
    segs.push({ len: TRACK.STATION_HALF * 2 + st1, k: 0 }, { len: a1, k: ang1 / a1 }, { len: st2, k: 0 }, { len: a2, k: ang2 / a2 }, { len: st3, k: 0 });
    s += st.leg;
  });
  let acc = 0; for (const g of segs) { if (g.k) CURVES.push({ s0: acc, s1: acc + g.len, k: g.k }); acc += g.len; }
  const total = acc;
  const n = Math.ceil(total / TRACK.step) + 2;
  const px = new Float64Array(n), pz = new Float64Array(n), ph = new Float64Array(n);
  let x = 0, z = 0, h = 0, segI = 0, segUsed = 0;
  for (let i = 0; i < n; i++) {
    px[i] = x; pz[i] = z; ph[i] = h;
    const seg = segs[Math.min(segI, segs.length - 1)];
    const hm = h + seg.k * TRACK.step / 2;
    x += Math.sin(hm) * TRACK.step; z += -Math.cos(hm) * TRACK.step; h += seg.k * TRACK.step;
    segUsed += TRACK.step; if (segUsed >= seg.len && segI < segs.length - 1) { segI++; segUsed = 0; }
  }
  Object.assign(TRACK, { n, px, pz, ph, len: total });
  STATIONS.forEach((st, i) => { st.s = stS[i]; st.idx = i; st.stopS = st.s + TRACK.STOP_AHEAD; st.big = ['tokyo', 'ueno', 'omiya', 'utsunomiya'].includes(st.id); });
  planFeatures();
  planRace();
  planTracks();
}
const ST = id => STATIONS.find(s => s.id === id);

/* ── features along the line: viaducts, rivers + bridges, tunnels, level crossings ── */
function planFeatures() {
  const via = (a, b, h) => { FEAT.viaducts.push({ a, b }); FEAT.elev.push({ a, b, h, r: 260, type: 'viaduct' }); };
  via(ST('tokyo').s + 600, ST('ueno').s - 600, 7.5);
  via(ST('urawa').s + 560, ST('omiya').s - 560, 7.5);
  const river = (name, en, s, water, flood, h, color) => {
    const half = water / 2 + flood;
    FEAT.rivers.push({ name, en, s, water, flood, half, color });
    FEAT.elev.push({ a: s - half - 30, b: s + half + 30, h, r: 250, type: 'embank' });
  };
  river('荒川', 'Arakawa', ST('akabane').s + 610, 110, 70, 8.5, 0x5f7f99);
  river('元荒川', 'Moto-Arakawa', ST('omiya').s + 980, 26, 14, 4.5, 0x7a4636);
  river('利根川', 'Tone River', ST('koga').s - 760, 140, 80, 9, 0x8a3b2c);
  river('思川', 'Omoi River', ST('oyama').s - 820, 40, 30, 5, 0x3f6d8a);
  const tun = (name, a, b) => FEAT.tunnels.push({ name, a, b, hill: rr(26, 40) });
  tun('第一小山トンネル', ST('oyama').s + 700, ST('oyama').s + 1060);
  tun('石橋トンネル', ST('ishibashi').s + 560, ST('ishibashi').s + 880);
  tun('古河トンネル', ST('koga').s + 520, ST('koga').s + 760);
  // level crossings (suburb / country), away from everything else
  for (let i = 4; i < STATIONS.length - 1; i++) {
    const st = STATIONS[i], nx = STATIONS[i + 1];
    for (const f of [.3, .72]) {
      const s = Math.round(lerp(st.s, nx.s, f));
      if (elevAt(s) > .01 || inTunnelZone(s, 120) || FEAT.rivers.some(r => Math.abs(r.s - s) < r.half + 350)) continue;
      FEAT.crossings.push({ s });
    }
  }
}
/* ── the HU300's route: runs beside the line, but takes its own way round hills
      and on a couple of detours, so it disappears and comes back ── */
const RACE = { base: -19, detours: [] };
function raceOff(s) {
  let o = RACE.base;
  for (const d of RACE.detours) {
    if (s <= d.a - d.r || s >= d.b + d.r) continue;
    const k = s < d.a ? smooth((s - (d.a - d.r)) / d.r) : s > d.b ? smooth(((d.b + d.r) - s) / d.r) : 1;
    o = Math.min(o, lerp(RACE.base, d.to, k));
  }
  return o;
}
function planRace() {
  for (const t of FEAT.tunnels) RACE.detours.push({ a: t.a - 140, b: t.b + 140, r: 300, to: -345, why: 'hill' });
  const busy = (a, b) => FEAT.rivers.some(r => r.s + r.half + 60 > a && r.s - r.half - 60 < b) || FEAT.crossings.some(c => c.s > a - 40 && c.s < b + 40) ||
    RACE.detours.some(d => d.b + d.r > a && d.a - d.r < b) || STATIONS.some(st => st.s + 330 > a && st.s - 330 < b) || elevAt(a) > 0 || elevAt(b) > 0;
  let n = 0;
  for (let i = ST('omiya').idx; i < STATIONS.length - 1 && n < 2; i++) {
    const c = (STATIONS[i].s + STATIONS[i + 1].s) / 2;
    for (const dc of [0, -300, 300]) {
      const a = c + dc - 220, b = c + dc + 220;
      if (!busy(a - 260, b + 260)) { RACE.detours.push({ a, b, r: 260, to: -150, why: 'detour' }); n++; break; }
    }
  }
}
function inTunnel(s) { return FEAT.tunnels.some(t => s > t.a && s < t.b); }
function inTunnelZone(s, pad = 0) { return FEAT.tunnels.some(t => s > t.a - 160 - pad && s < t.b + 160 + pad); }
function riverAt(s) { return FEAT.rivers.find(r => Math.abs(s - r.s) < r.half); }
function featureAt(s) { for (const e of FEAT.elev) if (s > e.a - e.r && s < e.b + e.r) return e; return null; }
// elevation of the rail top above the base level (0); ground is GROUND
function elevAt(s) {
  let y = 0;
  for (const e of FEAT.elev) {
    if (s < e.a - e.r || s > e.b + e.r) continue;
    const k = s < e.a ? smooth((s - (e.a - e.r)) / e.r) : s > e.b ? smooth(((e.b + e.r) - s) / e.r) : 1;
    y = Math.max(y, e.h * k);
  }
  return y;
}
function zoneAt(s) {
  let z = STATIONS[0].zone;
  for (const st of STATIONS) if (s > st.s - 900) z = st.zone;
  return z;
}

const _tf = { x: 0, z: 0, h: 0 };
function frame(s) {
  const f = clamp(s / TRACK.step, 0, TRACK.n - 1.001), i = Math.floor(f), t = f - i;
  _tf.x = lerp(TRACK.px[i], TRACK.px[i + 1], t); _tf.z = lerp(TRACK.pz[i], TRACK.pz[i + 1], t); _tf.h = lerp(TRACK.ph[i], TRACK.ph[i + 1], t);
  return _tf;
}
// world position of a point at (s, lateral offset, height above the rail top)
function posAt(s, off, y, out = new THREE.Vector3()) {
  const f = frame(s);
  return out.set(f.x - Math.cos(f.h) * off, y + elevAt(s), f.z - Math.sin(f.h) * off);
}
// same, but y is absolute (ground = GROUND)
function posG(s, off, y = GROUND, out = new THREE.Vector3()) {
  const f = frame(s);
  return out.set(f.x - Math.cos(f.h) * off, y, f.z - Math.sin(f.h) * off);
}
function headingAt(s) { return frame(s).h; }
const yawAt = s => -headingAt(s) + Math.PI / 2;

/* ═══ TRACK LAYOUT ═══
   Each track: off(s) lateral offset, s0..s1. 'main' tracks run the whole line,
   'siding' tracks run through big stations, 'link' tracks are the diverging
   leg of a switch (turnout).                                                 */
const TRACKS = [];
const TURNOUTS = [];
function addLink(s0, s1, o0, o1) {
  // S-curve from offset o0 at s0 to o1 at s1
  const off = s => lerp(o0, o1, smooth((s - s0) / (s1 - s0)));
  TRACKS.push({ kind: 'link', s0, s1, off, o0, o1 });
}
function planTracks() {
  const last = STATIONS.length - 1;
  TRACKS.push({ kind: 'main', s0: 0, s1: TRACK.len, off: () => TRACK.PLAYER, player: true });
  TRACKS.push({ kind: 'main', s0: 0, s1: TRACK.len, off: () => TRACK.OPP });
  TRACKS.push({ kind: 'race', s0: 0, s1: TRACK.len, off: raceOff });
  for (const st of STATIONS) {
    if (st.big) {
      for (const sg of [1, -1]) {
        const o1 = sg * 10.5, o2 = sg * 14.5, m = sg * 2;
        const first = st.idx === 0, end = st.idx === last;
        TRACKS.push({ kind: 'siding', s0: first ? 0 : st.s - 150, s1: end ? TRACK.len : st.s + 150, off: () => o1 });
        TRACKS.push({ kind: 'siding', s0: first ? 0 : st.s - 110, s1: end ? TRACK.len : st.s + 110, off: () => o2 });
        if (!first) { addLink(st.s - 230, st.s - 150, m, o1); addLink(st.s - 150, st.s - 110, o1, o2); }
        if (!end) { addLink(st.s + 150, st.s + 230, o1, m); addLink(st.s + 110, st.s + 150, o2, o1); }
      }
    }
    // a crossover between the two main lines after every station
    if (st.idx < last) addLink(st.s + 260, st.s + 320, TRACK.OPP, TRACK.PLAYER);
  }
  // a switch exists at each end of a link that lies on a track continuing past it
  const through = (s, o, dir) => TRACKS.some(t => t.kind !== 'link' && Math.abs(t.off(s) - o) < .01 &&
    (dir > 0 ? t.s0 <= s + .01 && t.s1 >= s + 12 : t.s0 <= s - 12 && t.s1 >= s - .01));
  for (const l of TRACKS.filter(t => t.kind === 'link')) {
    if (through(l.s0, l.o0, 1)) TURNOUTS.push({ s: l.s0, off: l.o0, dir: 1, side: Math.sign(l.o1 - l.o0) });
    if (through(l.s1, l.o1, -1)) TURNOUTS.push({ s: l.s1, off: l.o1, dir: -1, side: Math.sign(l.o0 - l.o1) });
  }
}
function tracksAt(s) { const o = []; for (const t of TRACKS) if (s >= t.s0 && s <= t.s1) { const v = t.off(s); if (Math.abs(v) < 30) o.push(v); } return o; }
function extentsAt(s) { const o = tracksAt(s); return [Math.min(...o), Math.max(...o)]; }

/* ── sweep: extrude a profile [(lat, y, abs?)...] along the track between s0..s1.
      profile may be a function of s; off may be a number or a function of s.   */
function sweep(profile, s0, s1, step, off, opts = {}) {
  const rows = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
  const prof0 = typeof profile === 'function' ? profile(s0) : profile;
  const np = prof0.length;
  const pos = new Float32Array(rows * np * 3), uv = new Float32Array(rows * np * 2);
  const v = new THREE.Vector3();
  for (let r = 0; r < rows; r++) {
    const s = lerp(s0, s1, r / (rows - 1));
    const P = typeof profile === 'function' ? profile(s) : profile;
    const o = typeof off === 'function' ? off(s) : off;
    let pl = 0;
    for (let j = 0; j < np; j++) {
      if (j) pl += Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]);
      if (P[j][2]) posG(s, o + P[j][0], P[j][1], v); else posAt(s, o + P[j][0], P[j][1], v);
      const k = (r * np + j) * 3; pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
      uv[(r * np + j) * 2] = opts.uLen ? pl / opts.uLen : j / (np - 1);
      uv[(r * np + j) * 2 + 1] = (s - s0) / (opts.vLen || 1);
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) for (let j = 0; j < np - 1; j++) {
    const a = r * np + j, b = a + 1, c = a + np, d = c + 1;
    if (opts.flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/* ═══ TRACK + CATENARY MESHES (built per chunk) ═══ */
const CHUNK = 400;
const chunks = [];
const MAT = {};
function trackMaterials() {
  MAT.rail = new THREE.MeshStandardMaterial({ color: 0x8a7a6c, metalness: .6, roughness: .45 });
  MAT.railTop = new THREE.MeshStandardMaterial({ color: 0xd8dade, metalness: .9, roughness: .25 });
  MAT.ballast = new THREE.MeshStandardMaterial({ map: ballastTex(), roughness: 1 });
  MAT.sleeper = new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: .9 });
  MAT.pole = new THREE.MeshStandardMaterial({ color: 0xa8a6a0, roughness: .8 });
  MAT.steel = new THREE.MeshStandardMaterial({ color: 0x8d949a, metalness: .5, roughness: .5 });
  const lt = latticeTex(); lt.repeat.set(1, 12);
  MAT.lattice = new THREE.MeshStandardMaterial({ map: lt, color: 0x9aa3a8, metalness: .5, roughness: .55, alphaTest: .5, side: THREE.DoubleSide });
  const lb = latticeTex(); lb.repeat.set(14, 1);
  MAT.latticeB = new THREE.MeshStandardMaterial({ map: lb, color: 0x9aa3a8, metalness: .5, roughness: .55, alphaTest: .5, side: THREE.DoubleSide });
  MAT.wire = new THREE.LineBasicMaterial({ color: 0x2c2a28 });
  MAT.insul = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: .5 });
  MAT.machine = new THREE.MeshStandardMaterial({ color: 0x8c949a, roughness: .6, metalness: .3 });
}
const SLEEPER_GEO = new THREE.BoxGeometry(.24, .16, 2.1);
const POLE_GEO = new THREE.CylinderGeometry(.16, .22, 9, 10).translate(0, 4.5, 0);
const ARM_GEO = new THREE.CylinderGeometry(.045, .045, 1, 6).rotateZ(Math.PI / 2).translate(.5, 0, 0);
const INS_GEO = new THREE.CylinderGeometry(.09, .09, .35, 8);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function ballastProfile(s) {
  const [mn, mx] = extentsAt(s);
  return [[mn - 3.0, -.95], [mn - 1.9, -.2], [mx + 1.9, -.2], [mx + 3.0, -.95]];
}
function buildTrackChunk(s0, s1, group) {
  // ballast bed (follows the outermost tracks)
  const bm = new THREE.Mesh(sweep(ballastProfile, s0, s1, 4, 0, { uLen: 3, vLen: 3 }), MAT.ballast); bm.receiveShadow = true; group.add(bm);
  // rails + sleepers for every track touching this chunk
  const railG = [], topG = [], sl = [];
  const p = new THREE.Vector3();
  for (const t of TRACKS) {
    const a = Math.max(s0, t.s0), b = Math.min(s1, t.s1); if (b - a < .5) continue;
    for (const side of [-1, 1]) {
      const c = side * TRACK.gauge / 2;
      railG.push(sweep([[c - .035, -.17], [c - .035, -.02], [c + .035, -.02], [c + .035, -.17]], a, b, t.kind === 'link' ? 2 : 5, t.off));
      topG.push(sweep([[c - .036, -.02], [c + .036, -.02]], a, b, t.kind === 'link' ? 2 : 5, t.off));
    }
    for (let s = Math.ceil(a / .62) * .62; s < b; s += .62) {
      const o = t.off(s), d = (t.off(s + .5) - t.off(s - .5));
      if (t.kind === 'link' && TRACKS.some(m => m.kind !== 'link' && s >= m.s0 && s <= m.s1 && Math.abs(m.off(s) - o) < 1.4)) continue;
      sl.push(s, o, Math.atan(d));
    }
  }
  // the HU300's own track bed (hidden under the main ballast when it runs alongside)
  group.add(new THREE.Mesh(sweep([[-2.3, -1.0], [-1.5, -.23], [1.5, -.23], [2.3, -1.0]], s0, s1, 4, raceOff, { uLen: 3, vLen: 3 }), MAT.ballast));
  const m1 = new THREE.Mesh(mergeGeometries(railG), MAT.rail); m1.castShadow = true;
  group.add(m1, new THREE.Mesh(mergeGeometries(topG), MAT.railTop));
  const im = new THREE.InstancedMesh(SLEEPER_GEO, MAT.sleeper, sl.length / 3);
  const o = new THREE.Object3D();
  for (let i = 0; i < sl.length; i += 3) {
    posAt(sl[i], sl[i + 1], -.2, p); o.position.copy(p); o.rotation.set(0, yawAt(sl[i]) + sl[i + 2], 0); o.updateMatrix(); im.setMatrixAt(i / 3, o.matrix);
  }
  im.receiveShadow = true; group.add(im);
  buildCatenary(s0, s1, group);
}

/* catenary: cantilever poles (2 tracks) or portal gantries (city / many tracks) */
function buildCatenary(s0, s1, group) {
  const p = new THREE.Vector3(), o = new THREE.Object3D();
  const poles = [], arms = [], ins = [], gant = [];
  for (let s = Math.ceil(s0 / 50) * 50; s < s1; s += 50) {
    if (inTunnel(s)) continue;
    const rv = riverAt(s); if (rv && Math.abs(s - rv.s) < rv.water / 2 + rv.flood - 2) continue; // truss carries the wires
    const offs = tracksAt(s).filter((_, i, arr) => true);
    const [mn, mx] = extentsAt(s);
    const yaw = yawAt(s);
    const gantry = offs.length > 2 || zoneAt(s) === 'city';
    if (gantry) {
      const a = mn - 2.2, b = mx + 2.2;
      for (const lat of [a, b]) { posAt(s, lat, -.6, p); gant.push({ p: p.clone(), sx: .55, sy: 9.4, sz: .55, yaw, y: 4.7 }); }
      posAt(s, (a + b) / 2, 8.3, p); gant.push({ p: p.clone(), sx: .7, sy: .9, sz: b - a + .5, yaw, y: 0, beam: true });
      for (const t of offs) { posAt(s, t, 7.0, p); arms.push({ p: p.clone(), len: 1.4, yaw, vert: true }); }
    } else {
      for (const side of [-1, 1]) {
        const poleOff = side > 0 ? mx + 2.4 : mn - 2.4;
        posAt(s, poleOff, -.6, p); poles.push({ p: p.clone(), yaw });
        for (const t of offs.filter(t => Math.sign(t) === side)) {
          for (const y of [5.25, 6.3]) { posAt(s, poleOff, y, p); arms.push({ p: p.clone(), len: Math.abs(t - poleOff) + .3, yaw: yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2) }); }
          posAt(s, poleOff - side * .5, 5.25, p); ins.push({ p: p.clone(), yaw });
        }
      }
    }
  }
  if (poles.length) {
    const im = new THREE.InstancedMesh(POLE_GEO, MAT.pole, poles.length);
    poles.forEach((q, i) => { o.position.copy(q.p); o.rotation.set(0, q.yaw, 0); o.scale.set(1, 1, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = true; group.add(im);
  }
  if (arms.length) {
    const im = new THREE.InstancedMesh(ARM_GEO, MAT.steel, arms.length);
    arms.forEach((q, i) => {
      o.position.copy(q.p);
      if (q.vert) { o.rotation.set(0, q.yaw, -Math.PI / 2); o.scale.set(q.len, 1, 1); }
      else { o.rotation.set(0, q.yaw, 0); o.scale.set(q.len, 1, 1); }
      o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    });
    group.add(im);
  }
  if (ins.length) {
    const im = new THREE.InstancedMesh(INS_GEO, MAT.insul, ins.length);
    ins.forEach((q, i) => { o.position.copy(q.p); o.rotation.set(0, q.yaw, Math.PI / 2); o.scale.set(1, 1, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    group.add(im);
  }
  for (const beam of [false, true]) {
    const list = gant.filter(q => !!q.beam === beam); if (!list.length) continue;
    const im = new THREE.InstancedMesh(UNIT_BOX, beam ? MAT.latticeB : MAT.lattice, list.length);
    list.forEach((q, i) => { o.position.copy(q.p); o.position.y += q.y; o.rotation.set(0, q.yaw, 0); o.scale.set(q.sx, q.sy, q.sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = true; group.add(im);
  }
  // wires
  const pts = [], a = new THREE.Vector3(), b = new THREE.Vector3();
  const seg = (sA, oA, yA, sB, oB, yB) => { posAt(sA, oA, yA, a); posAt(sB, oB, yB, b); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); };
  const sag = (q, top, d) => top - d * Math.sin((((q % 50) + 50) % 50) / 50 * Math.PI);
  for (const t of TRACKS) {
    if (t.kind === 'link') continue;
    const far = t.kind === 'race';
    const A = Math.max(s0, t.s0), B = Math.min(s1, t.s1); if (B - A < 1) continue;
    for (let s = A; s < B; s += 5) {
      const s2 = Math.min(s + 5, B), o1 = t.off(s), o2 = t.off(s2);
      if (far && (Math.abs(o1) > 30 || Math.abs(o2) > 30)) continue;
      const stg = q => .2 * Math.sin(q / 50 * Math.PI);
      seg(s, o1 + stg(s), 5.2, s2, o2 + stg(s2), 5.2);
      seg(s, o1, sag(s, 6.3, .7), s2, o2, sag(s2, 6.3, .7));
      if (Math.round(s) % 10 === 0) seg(s, o1 + stg(s), 5.2, s, o1, sag(s, 6.3, .7));
    }
  }
  // feeder wires along the pole tops (not inside tunnels)
  for (let s = s0; s < s1; s += 5) {
    if (inTunnel(s)) continue;
    const s2 = Math.min(s + 5, s1);
    for (const side of [-1, 1]) {
      const po = q => { const [mn, mx] = extentsAt(q); return side > 0 ? mx + 2.4 : mn - 2.4; };
      seg(s, po(s) + side * .35, sag(s, 8.2, .45), s2, po(s2) + side * .35, sag(s2, 8.2, .45));
      seg(s, po(s) - side * .1, sag(s, 8.7, .45), s2, po(s2) - side * .1, sag(s2, 8.7, .45));
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  group.add(new THREE.LineSegments(lg, MAT.wire));
}

/* ── switches (turnouts): moving blades + point machine ── */
const SWITCHES = [];
function buildSwitches() {
  const bladeG = new THREE.BoxGeometry(9, .1, .07).translate(-4.5, -.06, 0);
  for (const t of TURNOUTS) {
    const g = new THREE.Group();
    // heel 9 m from the tip in the direction the link runs
    const heelS = t.s + t.dir * 9;
    posAt(heelS, t.off, 0, g.position); g.rotation.y = yawAt(heelS) + (t.dir > 0 ? 0 : Math.PI);
    const blades = [];
    for (const z of [-1, 1]) {
      const bl = new THREE.Mesh(bladeG, MAT.railTop); bl.position.z = z * (TRACK.gauge / 2 - .07); g.add(bl); blades.push(bl);
    }
    const mach = new THREE.Mesh(new THREE.BoxGeometry(1.1, .45, .6), MAT.machine);
    // point machine beside the tip, on the outside of the diverging side
    mach.position.set(-9, -.05, (t.side * t.dir > 0 ? -1 : 1) * 1.9); g.add(mach);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(.08, .05, 1.4), MAT.steel); rod.position.set(-8.6, -.12, mach.position.z / 2); g.add(rod);
    const sw = { ...t, g, blades, pos: 1, target: 1, zSign: t.side * t.dir > 0 ? -1 : 1 };
    g.userData.dyn = true; SWITCHES.push(sw); addToChunk(t.s, g);
  }
}
function updateSwitches(dt, trainS, camPos) {
  for (const sw of SWITCHES) {
    // as the train comes near, the points swing across (and back once it has gone)
    const d = sw.s - trainS;
    sw.target = d > 30 && d < 260 ? -1 : 1;
    if (sw.pos !== sw.target) {
      const before = sw.pos;
      sw.pos = sw.target > sw.pos ? Math.min(sw.target, sw.pos + dt * 1.2) : Math.max(sw.target, sw.pos - dt * 1.2);
      if (Math.abs(before) === 1 && sw.g.parent && sw.g.parent.visible && camPos.distanceTo(sw.g.position) < 140) sfx('switch');
    }
    const ang = .013 * sw.pos * sw.zSign;
    sw.blades.forEach((b, i) => { b.rotation.y = ang; b.position.z = (i ? 1 : -1) * (TRACK.gauge / 2 - .07); });
  }
}
function chunkFor(s) { return chunks[clamp(Math.floor(s / CHUNK), 0, chunks.length - 1)]; }
function addToChunk(s, obj) { chunkFor(s).group.add(obj); }
