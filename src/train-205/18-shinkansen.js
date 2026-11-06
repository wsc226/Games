/* ═══ SHINKANSEN: Tohoku Shinkansen viaduct beside the line, stations at Omiya
   and Utsunomiya with E5+E6, E7, E8 parked, and E5s that zoom past.
   The viaduct runs at lateral offset shkOff(s) on the left (+) side.          */
const SHK = { rail: GROUND + 12.6, half: 6.6, pts: null, tracks: [], gauge: 1.435, stations: [] };
function shkOff(s) {
  const P = SHK.pts;
  if (s <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (s <= P[i][0]) { const [a, la] = P[i - 1], [b, lb] = P[i]; return lerp(la, lb, smooth((s - a) / (b - a))); }
  return P[P.length - 1][1];
}
function shkStationK(s) { // 0..1 how much of a station deck there is at s
  let k = 0;
  for (const st of SHK.stations) k = Math.max(k, smooth((260 - Math.abs(s - st.s)) / 90));
  return k;
}
function planShk() {
  const om = ST('omiya'), ku = ST('kuki'), ut = ST('utsunomiya'), FAR = 520, NEAR = 64;
  SHK.pts = [[0, FAR], [om.s - 1800, FAR], [om.s - 450, NEAR], [ku.s + 150, NEAR], [ku.s + 1600, FAR], [ut.s - 1800, FAR], [ut.s - 420, NEAR], [TRACK.len, NEAR]];
  SHK.stations = [om, ut];
  const add = (s0, s1, o) => SHK.tracks.push({ s0, s1, off: typeof o === 'function' ? o : s => shkOff(s) + o });
  add(0, TRACK.len, -3.5); add(0, TRACK.len, 3.5);
  for (const st of SHK.stations) for (const sg of [-1, 1]) {
    const end = st.idx === STATIONS.length - 1;
    add(st.s - 160, end ? TRACK.len : st.s + 160, sg * 11);
    const link = (a, b, o0, o1) => add(a, b, s => shkOff(s) + lerp(o0, o1, smooth((s - a) / (b - a))));
    link(st.s - 290, st.s - 160, sg * 3.5, sg * 11);
    if (!end) link(st.s + 160, st.s + 290, sg * 11, sg * 3.5);
  }
}
function shkHalf(s) { return SHK.half + 9.6 * shkStationK(s); }
// is a scenery item at (s, lat) on the Shinkansen corridor?
function shkBlocked(s, lat, r) { return Math.abs(lat - shkOff(s)) < shkHalf(s) + r + 3; }

/* ── viaduct, slab track, gantries, wires (per chunk) ── */
const SKM = {};
function shkMaterials() {
  SKM.deck = new THREE.MeshStandardMaterial({ map: concreteTex(), color: 0xd9d6cf, roughness: .9 });
  SKM.slab = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: .9 });
  SKM.platform = new THREE.MeshStandardMaterial({ map: platformTopTex(), roughness: .9 });
  SKM.fence = new THREE.MeshStandardMaterial({ color: 0xf2f3f4, roughness: .5 });
  SKM.roof = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, roughness: .5, metalness: .3, side: THREE.DoubleSide });
  SKM.under = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: .7, metalness: .3 });
  SKM.wheel = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: .4, metalness: .8 });
  SKM.bellows = new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: .9 });
}
function buildShkChunk(s0, s1, group) {
  const R0 = SHK.rail;
  // deck with parapets (wider at the stations)
  const deck = s => { const h = shkHalf(s), o = shkOff(s); return [[o - h, R0 - 2.2, 1], [o - h, R0 + .6, 1], [o - h + .3, R0 + .6, 1], [o - h + .3, R0 - .55, 1], [o + h - .3, R0 - .55, 1], [o + h - .3, R0 + .6, 1], [o + h, R0 + .6, 1], [o + h, R0 - 2.2, 1], [o - h, R0 - 2.2, 1]]; };
  const pg = [sweep(deck, s0, s1, 5, 0, { uLen: 3, vLen: 3 })];
  const far = shkOff(s0) > 300 && shkOff(s1) > 300;
  // piers (T-shaped), more columns under station decks
  for (let s = Math.ceil(s0 / 25) * 25; s < s1; s += 25) {
    const o = shkOff(s), h = shkHalf(s), H = R0 - 2.2 - GROUND;
    const cols = h > 9 ? [o - h + 3, o, o + h - 3] : [o];
    for (const c of cols) { const g = UNIT_BOX.clone().scale(1.8, H, 1.8), p = posG(s, c, GROUND + H / 2); g.rotateY(yawAt(s)); g.translate(p.x, p.y, p.z); pg.push(g); }
    const cap = UNIT_BOX.clone().scale(2.2, 1.0, h * 2 - .6), p = posG(s, o, R0 - 2.7); cap.rotateY(yawAt(s)); cap.translate(p.x, p.y, p.z); pg.push(cap);
  }
  // slab track + rails
  const rail = [], top = [], slab = pg;
  if (far) { const m = new THREE.Mesh(mergeGeometries(pg.map(g => g.index ? g.toNonIndexed() : g)), SKM.deck); m.castShadow = true; group.add(m); return; }
  for (const t of SHK.tracks) {
    const a = Math.max(s0, t.s0), b = Math.min(s1, t.s1); if (b - a < .5) continue;
    slab.push(sweep([[-1.3, R0 - .55, 1], [-1.3, R0 - .2, 1], [1.3, R0 - .2, 1], [1.3, R0 - .55, 1]], a, b, 5, t.off));
    for (const sd of [-1, 1]) {
      const c = sd * SHK.gauge / 2;
      rail.push(sweep([[c - .035, R0 - .2, 1], [c - .035, R0 - .02, 1], [c + .035, R0 - .02, 1], [c + .035, R0 - .2, 1]], a, b, 5, t.off));
      rail.push(sweep([[c - .036, R0 - .02, 1], [c + .036, R0 - .02, 1]], a, b, 5, t.off));
    }
  }
  { const m = new THREE.Mesh(mergeGeometries(slab.map(g => g.index ? g.toNonIndexed() : g)), SKM.deck); m.castShadow = m.receiveShadow = true; group.add(m); }
  if (rail.length) group.add(new THREE.Mesh(mergeGeometries(rail), MAT.railTop));
  // lattice gantries every 50 m + wires
  const o3 = new THREE.Object3D(), cols = [], beams = [], p = new THREE.Vector3();
  for (let s = Math.ceil(s0 / 50) * 50; s < s1; s += 50) {
    const o = shkOff(s), h = shkHalf(s) - .6, yaw = yawAt(s);
    for (const l of [o - h, o + h]) { posG(s, l, R0 + 4.6, p); cols.push({ p: p.clone(), sx: .6, sy: 10, sz: .6, yaw }); }
    posG(s, o, R0 + 8.6, p); beams.push({ p: p.clone(), sx: .8, sy: 1.0, sz: 2 * h, yaw });
  }
  for (const [list, mat] of [[cols, MAT.lattice], [beams, MAT.latticeB]]) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(UNIT_BOX, mat, list.length);
    list.forEach((q, i) => { o3.position.copy(q.p); o3.rotation.set(0, q.yaw, 0); o3.scale.set(q.sx, q.sy, q.sz); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); });
    im.castShadow = true; group.add(im);
  }
  const pts = [], a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const t of SHK.tracks) {
    const A = Math.max(s0, t.s0), B = Math.min(s1, t.s1); if (B - A < 1) continue;
    for (let s = A; s < B; s += 5) {
      const s2 = Math.min(s + 5, B);
      const sag = q => R0 + 6.4 - .6 * Math.sin((((q % 50) + 50) % 50) / 50 * Math.PI);
      posG(s, t.off(s), R0 + 5.1, a); posG(s2, t.off(s2), R0 + 5.1, b); pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      posG(s, t.off(s), sag(s), a); posG(s2, t.off(s2), sag(s2), b); pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  if (pts.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); group.add(new THREE.LineSegments(lg, MAT.wire)); }
}

/* ── liveries + car geometry (lofted rounded section, long nose) ── */
const LIVERY = {
  E5: { top: '#0f9466', low: '#f5f5f2', stripe: '#e8599a', split: .6, stripeH: .03, nose: 15, len: 25, noseLen: 26.5, H: 3.65, W: 3.35, light: '#fff' },
  E6: { top: '#c8133f', low: '#d8dbe0', stripe: '#8d939b', split: .58, stripeH: .02, nose: 9, len: 20, noseLen: 23, H: 3.45, W: 2.95, light: '#fff' },
  E7: { top: '#1d6fc4', low: '#f4f1e8', stripe: '#c27a3a', split: .76, stripeH: .05, nose: 9.1, len: 25, noseLen: 26, H: 3.65, W: 3.35, line: '#1d6fc4' },
  E8: { top: '#5b3e92', low: '#e7e8eb', stripe: '#e2a234', split: .6, stripeH: .04, nose: 9, len: 20, noseLen: 23, H: 3.45, W: 2.95 },
};
function shkTex(type, nose) {
  const L = LIVERY[type], len = nose ? L.noseLen : L.len, nf = nose ? L.nose / len : 0;
  return canvasTex(1024, 256, (g, W, H) => {
    const V = v => H * (1 - v), U = u => u * W;
    g.fillStyle = L.low; g.fillRect(0, 0, W, H);
    g.fillStyle = L.top; g.fillRect(0, 0, W, V(L.split));
    g.fillStyle = L.stripe; g.fillRect(0, V(L.split), W, V(L.split - L.stripeH) - V(L.split));
    if (L.line) { g.fillStyle = L.line; g.fillRect(0, V(L.split - L.stripeH - .05), W, 3); }
    g.fillStyle = '#4a4e55'; g.fillRect(0, V(.1), W, H);                      // underbody
    // side windows (none on the nose part)
    g.fillStyle = '#2a3542';
    const wEnd = nose ? 1 - nf * 1.02 : .97;
    for (let x = .05; x < wEnd; x += 1.05 / len) g.fillRect(U(x), V(.58), U(.55 / len), V(.46) - V(.58));
    // doors near the car ends
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (const x of nose ? [.03, 1 - nf - .07] : [.03, .93]) { g.fillRect(U(x), V(.6), 2, V(.12) - V(.6)); g.fillRect(U(x + .9 / len), V(.6), 2, V(.12) - V(.6)); }
    if (nose) {
      // cockpit canopy on top of the nose + headlights low on the sides
      g.fillStyle = '#10161e';
      g.beginPath(); g.ellipse(U(1 - nf * .62), V(.86), U(nf * .2), (V(.7) - V(.98)) / 2, 0, 0, 7); g.fill();
      g.fillStyle = '#fffbe8';
      g.beginPath(); g.ellipse(U(1 - nf * .28), V(.42), U(nf * .06), 9, 0, 0, 7); g.fill();
    }
  });
}
function noseProfile(t) {
  // t: 0 at the start of the nose → 1 at the tip
  return { w: 1 - .78 * Math.pow(t, 2.0), top: 1 - .74 * Math.pow(t, 1.25), bot: .12 * Math.pow(t, 3), n: lerp(5, 2.6, t) };
}
function shkCarGeometry(type, nose) {
  const L = LIVERY[type], len = nose ? L.noseLen : L.len, yb = .78, yt = L.H, N = 26;
  const rows = [];
  const body = nose ? len - L.nose : len;
  rows.push({ x: -len / 2, w: 1, top: 1, bot: 0, n: 5 }); rows.push({ x: -len / 2 + body, w: 1, top: 1, bot: 0, n: 5 });
  if (nose) for (let i = 1; i <= 18; i++) { const t = i / 18; rows.push({ x: -len / 2 + body + L.nose * t, ...noseProfile(t) }); }
  const pos = [], uv = [], idx = [];
  rows.forEach(r => {
    const yb2 = yb + (yt - yb) * r.bot, yt2 = yb + (yt - yb) * r.top, a = L.W / 2 * r.w, bh = (yt2 - yb2) / 2, yc = (yt2 + yb2) / 2;
    for (let j = 0; j <= N; j++) {
      const th = j / N * Math.PI * 2 - Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
      const z = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / r.n), y = yc + bh * Math.sign(s) * Math.pow(Math.abs(s), 2 / r.n) * (s > 0 ? 1 : 1);
      // slight tumblehome: narrower towards the roof
      const zt = z * (y > yc ? 1 - .1 * (y - yc) / bh : 1);
      pos.push(r.x, y, zt); uv.push((r.x + len / 2) / len, (y - yb2) / (yt2 - yb2));
    }
  });
  const rl = N + 1;
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < N; j++) { const a = i * rl + j, b = a + 1, c = a + rl, d = c + 1; idx.push(a, c, b, b, c, d); }
  // end caps
  for (const [ri, flip] of [[0, true], [rows.length - 1, false]]) {
    const ci = pos.length / 3, r = rows[ri];
    pos.push(r.x, yb + (yt - yb) * ((r.top + r.bot) / 2), 0); uv.push(ri ? 1 : 0, .5);
    for (let j = 0; j < N; j++) { const a = ri * rl + j, b = a + 1; if (flip) idx.push(ci, a, b); else idx.push(ci, b, a); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
const SHK_TEX = {};
function shkMat(type, nose) {
  const k = type + (nose ? 'n' : 'm');
  return SHK_TEX[k] ||= new THREE.MeshStandardMaterial({ map: shkTex(type, nose), roughness: .32, metalness: .15, side: THREE.DoubleSide });
}
function shkUnder(len, nose = 0, noseLen = 0) {
  // nose = +1 / -1: which end has the long nose (the bogie sits behind it)
  const g = [];
  const xs = [-len / 2 + 2.8, len / 2 - 2.8];
  if (nose > 0) xs[1] = len / 2 - noseLen - .8; if (nose < 0) xs[0] = -len / 2 + noseLen + .8;
  for (const x of xs) {
    g.push(UNIT_BOX.clone().scale(2.8, .45, 2.0).translate(x, .62, 0));
    for (const dx of [-1.25, 1.25]) for (const z of [-.72, .72]) g.push(new THREE.CylinderGeometry(.45, .45, .12, 14).rotateX(Math.PI / 2).translate(x + dx, .45, z));
  }
  return mergeGeometries(g.map(x => x.index ? x.toNonIndexed() : x));
}
/* consist: list of {type, nose: 1 (nose at +x) | -1 | 0}; built along -x from x = 0 */
function buildConsist(spec, opts = {}) {
  const cars = [];
  let x = 0;
  for (const c of spec) {
    const L = LIVERY[c.type], len = c.nose ? L.noseLen : L.len;
    const geo = shkCarGeometry(c.type, !!c.nose);
    if (c.nose < 0) geo.rotateY(Math.PI);
    const cx = x - len / 2;
    cars.push({ geo, mat: shkMat(c.type, !!c.nose), cx, len, type: c.type, nose: c.nose || 0, under: shkUnder(len, c.nose || 0, L.nose) });
    x -= len + .9;
  }
  const length = -x;
  if (opts.static) {
    // merge: one mesh per material for the whole consist
    const g = new THREE.Group(), byMat = new Map(), under = [], bel = [];
    cars.forEach((c, i) => {
      const geo = c.geo.clone().translate(c.cx, 0, 0);
      if (!byMat.has(c.mat)) byMat.set(c.mat, []); byMat.get(c.mat).push(geo);
      under.push(c.under.clone().translate(c.cx, 0, 0));
      if (i && !c.nose && !cars[i - 1].nose || i && (!!c.nose !== !!cars[i - 1].nose)) bel.push(UNIT_BOX.clone().scale(1.1, 2.4, 2.4).translate(c.cx + c.len / 2 + .45, 2.0, 0).toNonIndexed());
    });
    for (const [m, geos] of byMat) { const mesh = new THREE.Mesh(mergeGeometries(geos), m); mesh.castShadow = true; g.add(mesh); }
    g.add(new THREE.Mesh(mergeGeometries(under), SKM.under));
    if (bel.length) g.add(new THREE.Mesh(mergeGeometries(bel.map(b => { b.deleteAttribute('uv'); b.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b.attributes.position.count * 2), 2)); return b; })), SKM.bellows));
    g.userData.length = length;
    return g;
  }
  return { cars: cars.map(c => { const m = new THREE.Group(); const b = new THREE.Mesh(c.geo, c.mat); b.castShadow = true; m.add(b, new THREE.Mesh(c.under, SKM.under)); m.userData = { cx: c.cx, len: c.len }; return m; }), length };
}

/* ── Shinkansen stations: island platforms, fences, roofs, signs, parked trains ── */
function buildShkStations() {
  for (const st of SHK.stations) {
    const g = new THREE.Group(), R0 = SHK.rail, o = shkOff(st.s), s0 = st.s - 130, s1 = st.s + 130;
    for (const c of [-7.25, 7.25]) {
      const top = sweep(s => [[shkOff(s) + c - 2.0, R0 + 1.25, 1], [shkOff(s) + c + 2.0, R0 + 1.25, 1]], s0, s1, 5, 0, { vLen: 4 });
      g.add(new THREE.Mesh(top, SKM.platform));
      for (const e of [-2, 2]) g.add(new THREE.Mesh(sweep(s => e < 0 ? [[shkOff(s) + c + e, R0 - .5, 1], [shkOff(s) + c + e, R0 + 1.25, 1]] : [[shkOff(s) + c + e, R0 + 1.25, 1], [shkOff(s) + c + e, R0 - .5, 1]], s0, s1, 5, 0), STMAT.side));
      // platform-edge fences (with gaps for the doors) + roof on columns
      const fg = [], cg = [];
      for (let s = s0 + 2; s < s1 - 2; s += 3.2) for (const e of [-1.75, 1.75]) {
        const q = posG(s, o + c + e, R0 + 1.25 + .55); const b = UNIT_BOX.clone().scale(2.2, 1.1, .1); b.rotateY(yawAt(s)); b.translate(q.x, q.y, q.z); fg.push(b);
      }
      g.add(new THREE.Mesh(mergeGeometries(fg), SKM.fence));
      for (let s = s0 + 8; s < s1; s += 16) { const q = posG(s, o + c, R0 + 1.25 + 2.3); const b = new THREE.CylinderGeometry(.18, .18, 4.6, 8); b.translate(q.x, q.y, q.z); cg.push(b); }
      g.add(new THREE.Mesh(mergeGeometries(cg), STMAT.column));
      g.add(new THREE.Mesh(sweep(s => [[shkOff(s) + c - 3.2, R0 + 6.0, 1], [shkOff(s) + c, R0 + 5.6, 1], [shkOff(s) + c + 3.2, R0 + 6.0, 1]], s0 + 10, s1 - 10, 6, 0), SKM.roof));
      // station name boards
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), signMat(st));
      for (const ds of [-40, 40]) for (const fl of [0, Math.PI]) {
        const m = sign.clone(); posG(st.s + ds, o + c, R0 + 4.4, m.position); m.rotation.y = yawAt(st.s) + fl; m.translateZ(.05); g.add(m);
      }
    }
    // big "新幹線" sign on the station side
    const nt = textBoard([['新幹線 ' + st.ja, 64, .42], ['SHINKANSEN · ' + st.en.toUpperCase(), 26, .8]], { w: 640, h: 128, bg: '#1d4f9c', fg: '#fff' });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(26, 5.2), new THREE.MeshStandardMaterial({ map: nt, emissive: 0xffffff, emissiveMap: nt, emissiveIntensity: .25 }));
    posG(st.s, o - shkHalf(st.s) - .05, R0 - 5, nm.position); nm.rotation.y = yawAt(st.s); g.add(nm);
    mergeStatic(g);
    addToChunk(st.s, g);
    // a few people waiting on the Shinkansen platforms
    for (let i = 0; i < 10; i++) {
      const m = makePerson(R() < .15), c = R() < .5 ? -7.25 : 7.25, s = st.s + rr(-100, 100);
      posG(s, o + c + rr(-1, 1), R0 + 1.25, m.position); m.rotation.y = yawAt(s) + rr(0, 6); addToChunk(st.s, m);
    }
  }
  // parked trains
  const park = (st, spec, lane, shift = 0) => {
    const c = buildConsist(spec, { static: true }), L = c.userData.length;
    const s = st.s + L / 2 + shift;
    posG(s, shkOff(s) + lane, SHK.rail, c.position); c.rotation.y = yawAt(s);
    addToChunk(st.s, c); return c;
  };
  const om = ST('omiya'), ut = ST('utsunomiya');
  park(om, [{ type: 'E6', nose: 1 }, { type: 'E6' }, { type: 'E6' }, { type: 'E6', nose: -1 }, { type: 'E5', nose: 1 }, { type: 'E5' }, { type: 'E5' }, { type: 'E5', nose: -1 }], -11);
  park(om, [{ type: 'E7', nose: 1 }, { type: 'E7' }, { type: 'E7' }, { type: 'E7', nose: -1 }], 11, -10);
  park(om, [{ type: 'E8', nose: 1 }, { type: 'E8' }, { type: 'E8', nose: -1 }], -3.5, 40);
  park(ut, [{ type: 'E5', nose: 1 }, { type: 'E5' }, { type: 'E5' }, { type: 'E5', nose: -1 }], -11);
}

/* ── E5s zooming past on the viaduct ── */
const ZOOM = { c: null, active: false, s: 0, v: 0, nextT: 30, lane: 3.5, passed: false };
function buildZoomer() {
  const c = buildConsist([{ type: 'E5', nose: 1 }, { type: 'E5' }, { type: 'E5' }, { type: 'E5' }, { type: 'E5', nose: -1 }]);
  ZOOM.c = c; ZOOM.root = new THREE.Group(); c.cars.forEach(m => ZOOM.root.add(m)); W.scene.add(ZOOM.root); ZOOM.root.visible = false;
}
function updateZoomer(dt, player, camPos) {
  const Z = ZOOM;
  if (!Z.active) {
    // only when the viaduct is near the line and we are not at the very end
    if (G.t > Z.nextT && Math.abs(shkOff(player.s) - 64) < 5 && player.s < TRACK.len - 600) {
      Z.active = true; Z.passed = false; Z.v = 58; Z.lane = 3.5;
      Z.s = player.s - 650; Z.root.visible = true;   // comes up from behind and overtakes
    }
    return;
  }
  // slower through the stations
  const nearSt = SHK.stations.some(st => Math.abs(st.s - Z.s) < 350);
  Z.v = damp(Z.v, nearSt ? 30 : 64, .8, dt);
  Z.s += Z.v * dt;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const m of Z.c.cars) {
    const sc = Z.s + m.userData.cx, h = m.userData.len * .4;
    posG(sc + h, shkOff(sc + h) + Z.lane, SHK.rail, a); posG(sc - h, shkOff(sc - h) + Z.lane, SHK.rail, b);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.rotation.set(0, Math.atan2(-(a.z - b.z), a.x - b.x), 0);
  }
  if (!Z.passed && Z.c.cars[0].position.distanceTo(camPos) < 120) { Z.passed = true; noisy(2.2, .2, 900, .4); noisy(1.6, .1, 3000, .5, .3); }
  if (Z.s > player.s + 2200 || Z.s > TRACK.len - 50) { Z.active = false; Z.root.visible = false; Z.nextT = G.t + rr(35, 70); }
}
