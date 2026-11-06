/* ═══ STRUCTURES: viaducts, embankments, truss bridges, rivers, tunnels + hills ═══ */
const SMAT = {};
const EXTRAS = [];   // big objects with their own visibility check {group, center, r}
function structMaterials() {
  SMAT.concrete = new THREE.MeshStandardMaterial({ map: concreteTex(), color: 0xd0cdc6, roughness: .9 });
  SMAT.grass = new THREE.MeshStandardMaterial({ map: (() => { const t = grassTex(); t.repeat.set(1, 1); return t; })(), roughness: 1 });
  SMAT.hill = new THREE.MeshStandardMaterial({ map: (() => { const t = grassTex(); t.repeat.set(1, 1); return t; })(), color: 0xa9c79a, roughness: 1 });
  SMAT.girder = new THREE.MeshStandardMaterial({ color: 0x3f454b, roughness: .7, metalness: .4 });
  SMAT.water = new THREE.MeshStandardMaterial({ map: waterTex(), color: 0xbfe0f5, roughness: .12, metalness: .15 });
  SMAT.flood = new THREE.MeshStandardMaterial({ color: 0x8db35e, roughness: 1 });
  SMAT.tunnel = new THREE.MeshStandardMaterial({ map: concreteTex(), color: 0x8a867e, emissive: 0x2a2620, roughness: .95, side: THREE.DoubleSide });
  SMAT.lamp = new THREE.MeshBasicMaterial({ color: 0xffd28a });
  SMAT.rock = new THREE.MeshStandardMaterial({ color: 0x8b8a7a, roughness: 1 });
}

/* ── per-chunk: viaduct deck / fill walls / piers, embankments, bridge decks, tunnel tube ── */
function buildStructures(s0, s1, group) {
  const elevated = [];
  for (let s = s0; s <= s1; s += 5) if (elevAt(s) > .05) elevated.push(s);
  if (elevated.length) {
    const a = Math.max(s0, elevated[0] - 5), b = Math.min(s1, elevated[elevated.length - 1] + 5);
    const f = featureAt((a + b) / 2) || featureAt(a) || featureAt(b);
    if (f && f.type === 'viaduct') buildViaduct(a, b, group);
    else buildEmbankment(a, b, group);
  }
  // tunnel tube
  for (const t of FEAT.tunnels) {
    const a = Math.max(s0, t.a - .5), b = Math.min(s1, t.b + .5); if (b <= a) continue;
    const prof = [[-5.8, GROUND, 1]]; for (let i = 0; i <= 12; i++) { const an = Math.PI - i / 12 * Math.PI; prof.push([Math.cos(an) * 5.8, 3.4 + Math.sin(an) * 5.8, 1]); } prof.push([5.8, GROUND, 1]); prof.push([-5.8, GROUND + .01, 1]);
    const m = new THREE.Mesh(sweep(prof, a, b, 5, 0, { uLen: 4, vLen: 4 }), SMAT.tunnel); m.receiveShadow = true; group.add(m);
    const lamps = [];
    for (let s = Math.ceil(a / 25) * 25; s < b; s += 25) for (const lat of [-5.55, 5.55]) {
      const g = UNIT_BOX.clone().scale(.5, .14, .12); const p = posG(s, lat, 3.2); g.rotateY(yawAt(s)); g.translate(p.x, p.y, p.z); lamps.push(g);
    }
    if (lamps.length) group.add(new THREE.Mesh(mergeGeometries(lamps), SMAT.lamp));
  }
}
function buildViaduct(a, b, group) {
  // deck + parapets
  const E = s => { const [mn, mx] = extentsAt(s); return [Math.min(-7.4, mn - 5.4), Math.max(7.4, mx + 5.4)]; };
  const deck = s => { const [l, r] = E(s); return [[l, -1.7], [l, .45], [l + .3, .45], [l + .3, -.62], [r - .3, -.62], [r - .3, .45], [r, .45], [r, -1.7], [l, -1.7]]; };
  const m = new THREE.Mesh(sweep(deck, a, b, 5, 0, { uLen: 3, vLen: 3 }), SMAT.concrete); m.castShadow = m.receiveShadow = true; group.add(m);
  // solid fill walls on the low ramps, piers where it is high
  const lowBottom = s => { const e = elevAt(s); const k = smooth((e - 2.6) / .8); return lerp(GROUND, e - 1.7, k); };
  const wallL = s => [[E(s)[0], lowBottom(s), 1], [E(s)[0], -1.7]], wallR = s => [[E(s)[1], -1.7], [E(s)[1], lowBottom(s), 1]];
  group.add(new THREE.Mesh(sweep(wallL, a, b, 5, 0, { uLen: 3, vLen: 3 }), SMAT.concrete), new THREE.Mesh(sweep(wallR, a, b, 5, 0, { uLen: 3, vLen: 3 }), SMAT.concrete));
  const geos = [];
  for (let s = Math.ceil(a / 20) * 20; s < b; s += 20) {
    const e = elevAt(s); if (e < 3) continue;
    const [l, r] = E(s);
    for (const lat of [l + 2.8, r - 2.8, ...(r - l > 20 ? [(l + r) / 2] : [])]) {
      const h = e - 1.7 - GROUND, g = UNIT_BOX.clone().scale(1.1, h, 1.1), p = posG(s, lat, GROUND + h / 2);
      g.rotateY(yawAt(s)); g.translate(p.x, p.y, p.z); geos.push(g);
    }
    const cb = UNIT_BOX.clone().scale(1.2, .9, r - l - 4.4), p = posAt(s, (l + r) / 2, -2.15); cb.rotateY(yawAt(s)); cb.translate(p.x, p.y, p.z); geos.push(cb);
  }
  if (geos.length) { const pm = new THREE.Mesh(mergeGeometries(geos), SMAT.concrete); pm.castShadow = true; group.add(pm); }
}
function buildEmbankment(a, b, group) {
  // grass slopes, except where a bridge spans the river
  const ranges = []; let cur = null;
  for (let s = a; s <= b + .01; s += 2.5) {
    const onBridge = !!riverAt(s);
    if (!onBridge && !cur) cur = [s, s]; if (!onBridge && cur) cur[1] = s;
    if (onBridge && cur) { ranges.push(cur); cur = null; }
  }
  if (cur) ranges.push(cur);
  for (const [x0, x1] of ranges) {
    if (x1 - x0 < 1) continue;
    const prof = s => { const [mn, mx] = extentsAt(s), e = elevAt(s), w = 1.6 * Math.max(0, e - .33);
      return [[mn - 4.6 - w, GROUND - .02, 1], [mn - 4.6, -.95], [mx + 4.6, -.95], [mx + 4.6 + w, GROUND - .02, 1]]; };
    const m = new THREE.Mesh(sweep(prof, x0, x1, 4, 0, { uLen: 10, vLen: 10 }), SMAT.grass); m.receiveShadow = true; group.add(m);
  }
  // bridge deck (steel girders) where a river is spanned
  const r = FEAT.rivers.find(r => r.s + r.half > a && r.s - r.half < b);
  if (r) {
    const x0 = Math.max(a, r.s - r.half), x1 = Math.min(b, r.s + r.half);
    const g = [[-5.4, -2.2], [-5.4, -.6], [5.4, -.6], [5.4, -2.2], [-5.4, -2.2]];
    group.add(new THREE.Mesh(sweep(g, x0, x1, 5, 0), SMAT.girder));
    const gr = [[-2.0, -1.5], [-2.0, -.6], [2.0, -.6], [2.0, -1.5], [-2.0, -1.5]];
    group.add(new THREE.Mesh(sweep(gr, x0, x1, 5, raceOff), SMAT.girder));
  }
}

/* ── beams between two world points (for trusses, pylons) ── */
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
function beam(p1, p2, t, geos) {
  const len = p1.distanceTo(p2); if (len < .01) return;
  const g = UNIT_BOX.clone().scale(t, len, t);
  _by.subVectors(p2, p1).normalize();
  _bx.set(0, 1, 0); if (Math.abs(_by.y) > .95) _bx.set(1, 0, 0);
  _bz.crossVectors(_bx, _by).normalize(); _bx.crossVectors(_by, _bz).normalize();
  _bm.makeBasis(_bx, _by, _bz); _bm.setPosition((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
  g.applyMatrix4(_bm); geos.push(g);
}
/* ── rivers: water, flood plain, levees, truss bridge with piers ── */
function buildRivers() {
  for (const r of FEAT.rivers) {
    const g = new THREE.Group();
    const c = posG(r.s, 0, GROUND);
    const ang = yawAt(r.s) + Math.PI / 2 + rr(-.18, .18);           // river runs across the line
    r.cx = c.x; r.cz = c.z; r.dir = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
    const L = 3200;
    const plane = (w, y, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, w).rotateX(-Math.PI / 2), mat); m.position.set(c.x, y, c.z); m.rotation.y = ang; m.receiveShadow = true; g.add(m); return m; };
    const wt = SMAT.water.clone(); wt.map = SMAT.water.map.clone(); wt.map.repeat.set(L / 40, r.water / 40); wt.map.needsUpdate = true; r.waterMat = wt;
    plane(r.water + 2 * r.flood, GROUND + .1, SMAT.flood);
    plane(r.water, GROUND + .2, wt);
    // levees (堤防)
    const sh = new THREE.Shape(); sh.moveTo(-9, 0); sh.lineTo(-3, 4.6); sh.lineTo(3, 4.6); sh.lineTo(9, 0); sh.closePath();
    const lg = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }); lg.translate(0, 0, -L / 2); lg.rotateY(Math.PI / 2);
    for (const sd of [-1, 1]) {
      const m = new THREE.Mesh(lg, SMAT.grass); const off = r.water / 2 + r.flood + 9;
      m.position.set(c.x + Math.sin(ang) * off * sd, GROUND, c.z + Math.cos(ang) * off * sd); m.rotation.y = ang; m.receiveShadow = true; g.add(m);
    }
    // truss bridge spans
    const total = 2 * r.half, N = Math.max(1, Math.round(total / 48)), Ls = total / N;
    const tg = [], pg = [];
    const P = (s, lat, y) => posAt(s, lat, y);
    const small = r.water < 50;
    for (let i = 0; i < N; i++) {
      const sA = r.s - r.half + i * Ls, sB = sA + Ls;
      if (!small) {
        const panels = 6, H = 8.2, W = 4.9;
        for (const sd of [-1, 1]) {
          const lat = sd * W;
          beam(P(sA, lat, -.6), P(sB, lat, -.6), .5, tg);                                   // bottom chord
          beam(P(sA + Ls / panels / 2, lat, H), P(sB - Ls / panels / 2, lat, H), .5, tg);   // top chord
          for (let k = 0; k < panels; k++) {
            const b0 = sA + k * Ls / panels, b1 = b0 + Ls / panels, tm = (b0 + b1) / 2;
            beam(P(b0, lat, -.6), P(tm, lat, H), .38, tg); beam(P(tm, lat, H), P(b1, lat, -.6), .38, tg);
          }
        }
        for (let k = 0; k < panels; k++) {
          const tm = sA + (k + .5) * Ls / panels;
          beam(P(tm, -4.9, H), P(tm, 4.9, H), .3, tg);                                      // top lateral
          if (k < panels - 1) { const t2 = tm + Ls / panels; beam(P(tm, -4.9, H), P(t2, 4.9, H), .18, tg); beam(P(tm, 4.9, H), P(t2, -4.9, H), .18, tg); }
        }
        const t0 = sA + Ls / panels / 2, t1 = sB - Ls / panels / 2;
        for (const tm of [t0, t1]) beam(P(tm, -4.9, H - 1.4), P(tm, 4.9, H - 1.4), .5, tg); // portal bracing
      } else {
        for (const sd of [-1, 1]) beam(P(sA, sd * 4.2, -1.2), P(sB, sd * 4.2, -1.2), 1.1, tg); // plate girders
      }
      // the HU300 crosses on its own plate-girder bridge
      { const ro = raceOff((sA + sB) / 2); for (const sd of [-1, 1]) beam(P(sA, ro + sd * 1.5, -1.0), P(sB, ro + sd * 1.5, -1.0), .9, tg); }
      // pier under each joint
      for (const s of (i === 0 ? [sA, sB] : [sB])) {
        const e = elevAt(s), h = e - 2.2 - GROUND + 1, p = posG(s, 0, GROUND - 1 + h / 2);
        const pgeo = UNIT_BOX.clone().scale(3, h, 12); pgeo.rotateY(yawAt(s)); pgeo.translate(p.x, p.y, p.z); pg.push(pgeo);
        const rp = posG(s, raceOff(s), GROUND - 1 + h / 2), rg2 = UNIT_BOX.clone().scale(2.4, h, 4.5); rg2.rotateY(yawAt(s)); rg2.translate(rp.x, rp.y, rp.z); pg.push(rg2);
      }
    }
    const trussMat = new THREE.MeshStandardMaterial({ color: r.color, roughness: .55, metalness: .35 });
    const tm = new THREE.Mesh(mergeGeometries(tg), trussMat); tm.castShadow = true; g.add(tm);
    g.add(new THREE.Mesh(mergeGeometries(pg), SMAT.concrete));
    // river name board on the levee
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), new THREE.MeshStandardMaterial({ map: textBoard([[r.name, 54, .38], [r.en, 28, .78]], { w: 256, h: 70, bg: '#1d5ca8', fg: '#fff' }) }));
    const bp = posG(r.s - r.half - 22, -14, GROUND + 6.5); bd.position.copy(bp); bd.rotation.y = yawAt(r.s) + Math.PI / 2 + .5; g.add(bd);
    W.scene.add(g); EXTRAS.push({ group: g, center: c, r: 1800 });
  }
}
function inRiver(x, z, pad = 20) {
  for (const r of FEAT.rivers) {
    const dx = x - r.cx, dz = z - r.cz;
    const along = dx * r.dir.x + dz * r.dir.z, across = Math.abs(dx * r.dir.z - dz * r.dir.x);
    if (Math.abs(along) < 1700 && across < r.half + pad) return true;
  }
  return false;
}

/* ── tunnels: hill heightfield (with a hole at each portal) + portals ── */
function hillHeight(t, s, lat) {
  // low (13 m) over the portals so the entrance looks natural, rising to the full hill inside
  const ramp = 210, P = 13;
  let base;
  if (s < t.a) base = P * smooth((s - (t.a - ramp)) / ramp);
  else if (s > t.b) base = P * smooth(((t.b + ramp) - s) / ramp);
  else base = P + (t.hill - P) * Math.sin(Math.PI * (s - t.a) / (t.b - t.a)) ** .8;
  let h = base * Math.exp(-((lat / 130) ** 2)) * (1 + .12 * Math.sin(s * .021 + lat * .043) + .08 * Math.sin(lat * .09 - s * .013));
  if (s < t.a || s > t.b) h *= smooth((Math.abs(lat) - 7) / 26) * smooth((Math.abs(lat - raceOff(s)) - 4) / 22);
  return Math.max(0, h);
}
function buildTunnels() {
  for (const t of FEAT.tunnels) {
    t.a = Math.round(t.a / 10) * 10; t.b = Math.round(t.b / 10) * 10;
    const g = new THREE.Group();
    const S = []; for (let s = t.a - 230; s <= t.b + 230; s += 10) S.push(s);
    const L = []; for (let l = -300; l <= 300; l += 12) L.push(l);
    const pos = [], uv = [], idx = [], p = new THREE.Vector3();
    S.forEach((s, i) => L.forEach((l, j) => { { const hh = hillHeight(t, s, l); posG(s, l, GROUND + (hh < .4 ? hh - .6 : hh - .05), p); } pos.push(p.x, p.y, p.z); uv.push(l / 14, s / 14); }));
    const nc = L.length;
    for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < nc - 1; j++) {
      // leave a hole in front of each portal (the portal wall fills it)
      const portal = (S[i] === t.a - 10 || S[i] === t.b) && Math.abs(L[j]) < 40 && Math.abs(L[j + 1]) < 40 + 12;
      const portal2 = (S[i] === t.a - 10 || S[i] === t.b) && (Math.abs(L[j]) < 42 || Math.abs(L[j + 1]) < 42);
      if (portal || portal2) continue;
      const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const hill = new THREE.Mesh(geo, SMAT.hill); hill.castShadow = hill.receiveShadow = true; g.add(hill);
    // portal walls (earth face + concrete portal with the arch opening)
    for (const [s, dir] of [[t.a, -1], [t.b, 1]]) {
      const sFace = s + (dir < 0 ? -10 : 10) * .0;
      const outline = new THREE.Shape();
      const lats = []; for (let l = -48; l <= 48; l += 6) lats.push(l);
      const near = dir < 0 ? t.a - 10 : t.b + 10;
      outline.moveTo(-48, GROUND - .5);
      outline.lineTo(48, GROUND - .5);
      for (let k = lats.length - 1; k >= 0; k--) outline.lineTo(lats[k], GROUND + Math.max(hillHeight(t, sFace, lats[k]), hillHeight(t, near, lats[k])) + .3);
      outline.closePath();
      const arch = new THREE.Path(); arch.moveTo(-6.4, GROUND - .3); arch.lineTo(6.4, GROUND - .3);
      for (let i = 0; i <= 12; i++) { const an = i / 12 * Math.PI; arch.lineTo(Math.cos(an) * 6.4, 3.4 + Math.sin(an) * 6.4); }
      arch.closePath();
      const earth = new THREE.Shape(outline.getPoints()); const rect = new THREE.Path(); rect.moveTo(-8.5, GROUND - .3); rect.lineTo(8.5, GROUND - .3); rect.lineTo(8.5, 11.2); rect.lineTo(-8.5, 11.2); rect.closePath();
      earth.holes.push(rect);
      const conc = new THREE.Shape(rect.getPoints()); conc.holes.push(arch);
      const place = (shape, mat, ds) => {
        const sg = new THREE.ShapeGeometry(shape, 8); const pa = sg.attributes.position;
        for (let i = 0; i < pa.count; i++) { posG(s + ds, pa.getX(i), pa.getY(i), p); pa.setXYZ(i, p.x, p.y, p.z); }
        sg.computeVertexNormals(); const m = new THREE.Mesh(sg, mat); g.add(m); return m;
      };
      place(earth, new THREE.MeshStandardMaterial({ map: SMAT.hill.map, color: 0x9fb98e, roughness: 1, side: THREE.DoubleSide }), 0);
      place(conc, new THREE.MeshStandardMaterial({ map: concreteTex(), color: 0xc9c5bc, roughness: .9, side: THREE.DoubleSide }), dir * .6);
      // name plate above the arch
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.3), new THREE.MeshStandardMaterial({ map: textBoard([[t.name, 34, .5]], { w: 320, h: 64, bg: '#f4f1e8', border: '#333', bw: 4 }) }));
      posG(s + dir * .9, 0, 10.3, plate.position); plate.rotation.y = yawAt(s) + (dir < 0 ? -Math.PI / 2 : Math.PI / 2); g.add(plate);
    }
    // trees on the hill
    const trees = [];
    R = mulberry(t.a);
    for (let i = 0; i < 260; i++) {
      const s = rr(t.a - 200, t.b + 200), l = rr(-260, 260); if (Math.abs(l) < 14 && (s < t.a + 5 || s > t.b - 5)) continue;
      const h = hillHeight(t, s, l); if (h < 1.5) continue;
      trees.push({ p: posG(s, l, GROUND + h - .2), k: rr(.9, 1.6) });
    }
    const tr = new THREE.InstancedMesh(TREE_TRUNK, WMAT.trunk, trees.length), cr = new THREE.InstancedMesh(TREE_CROWN, WMAT.crown, trees.length);
    const o = new THREE.Object3D(), col = new THREE.Color();
    trees.forEach((q, i) => { o.position.copy(q.p); o.rotation.set(0, R() * 6, 0); o.scale.setScalar(q.k); o.updateMatrix(); tr.setMatrixAt(i, o.matrix); cr.setMatrixAt(i, o.matrix); cr.setColorAt(i, col.setHSL(.28 + R() * .05, .45, .22 + R() * .1)); });
    cr.castShadow = true; g.add(tr, cr);
    W.scene.add(g);
    EXTRAS.push({ group: g, center: posG((t.a + t.b) / 2, 0), r: 2000 });
  }
}
function inHill(s, lat) { return FEAT.tunnels.some(t => s > t.a - 230 && s < t.b + 230 && hillHeight(t, s, lat) > .4); }

/* ── distant mountains (follow the camera like the sky) ── */
function buildBackdrop() {
  const t = mountainTex(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(2600, 2600, 420, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1; W.scene.add(m); W.backdrop = m;
}
function updateExtras() {
  const p = W.camera.position;
  for (const e of EXTRAS) e.group.visible = e.center.distanceTo(p) < e.r;
}

// terrain height above GROUND at a track-relative point (hills only; 0 elsewhere)
function terrainAt(s, lat) { let h = 0; for (const t of FEAT.tunnels) if (s > t.a - 230 && s < t.b + 230) h = Math.max(h, hillHeight(t, s, lat)); return h; }
