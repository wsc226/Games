/* ═══ STATIONS: platforms, canopies, signs, boards, furniture, station buildings ═══
   Player trains use platform 1 (left side, +lat); the other direction uses platform 2. */
const STMAT = {};
const PLAT = { E: TRACK.PLAYER + 1.55, D: 4.5, Y: 1.1 };   // edge offset, depth, height above rail
function stationMaterials() {
  STMAT.top = new THREE.MeshStandardMaterial({ map: platformTopTex(), roughness: .9 });
  STMAT.side = new THREE.MeshStandardMaterial({ color: 0xa9a6a0, roughness: .95 });
  STMAT.roof = new THREE.MeshStandardMaterial({ color: 0x8e949a, roughness: .55, metalness: .35, side: THREE.DoubleSide });
  STMAT.roofUnder = new THREE.MeshStandardMaterial({ color: 0xe9ebec, roughness: .7, side: THREE.DoubleSide });
  STMAT.column = new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: .5 });
  STMAT.light = new THREE.MeshBasicMaterial({ color: 0xffffff });
  STMAT.dark = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: .6 });
  STMAT.bench = new THREE.MeshStandardMaterial({ color: 0x3d7fc2, roughness: .5 });
  STMAT.metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: .4, metalness: .6 });
  STMAT.green = new THREE.MeshStandardMaterial({ color: 0x1f9a48, roughness: .6 });
  STMAT.vendR = new THREE.MeshStandardMaterial({ map: vendingTex('#d8262a'), emissive: 0xffffff, emissiveMap: vendingTex('#d8262a'), emissiveIntensity: .25, roughness: .4 });
  STMAT.vendB = new THREE.MeshStandardMaterial({ map: vendingTex('#2462b8'), emissive: 0xffffff, emissiveMap: vendingTex('#2462b8'), emissiveIntensity: .25, roughness: .4 });
  STMAT.exit = new THREE.MeshStandardMaterial({ map: textBoard([['出口 Exit ➚', 46, .52]], { w: 320, h: 80, bg: '#f6d20c', fg: '#111' }), roughness: .5 });
  STMAT.clock = new THREE.MeshStandardMaterial({ map: clockTex(), roughness: .4 });
  STMAT.queue = new THREE.MeshStandardMaterial({ color: 0x2aa84f, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 });
  STMAT.brick = new THREE.MeshStandardMaterial({ map: brickTex(), roughness: .9 });
  STMAT.whiteStone = new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: .8 });
  STMAT.dome = new THREE.MeshStandardMaterial({ color: 0x4b5a55, roughness: .5, metalness: .3 });
  STMAT.glassBld = new THREE.MeshStandardMaterial({ color: 0x7fa6c4, roughness: .1, metalness: .6 });
  STMAT.trackNo = [1, 2].map(n => new THREE.MeshStandardMaterial({ map: textBoard([[String(n), 96, .55]], { bg: '#fff', fg: '#111', border: '#1f9a48', bw: 12 }), roughness: .5 }));
}
function signMat(st) {
  const i = st.idx, prev = STATIONS[i - 1], next = STATIONS[i + 1];
  const t = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1b1b'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '900 100px "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif'; g.fillText(st.ja.split('').join(' '), w / 2, 112);
    g.font = 'bold 26px "Hiragino Sans",sans-serif'; g.fillText(st.ja_read, w / 2, 148);
    g.textAlign = 'right'; g.font = '22px "Hiragino Sans",sans-serif'; g.fillText(st.ja, w - 60, 70); g.fillText(st.ko, w - 60, 100);
    if (st.no) {
      g.fillStyle = '#1f9a48'; rrect(g, 60, 26, 112, 118, 12); g.fill(); g.fillStyle = '#fff'; rrect(g, 70, 56, 92, 80, 8); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 22px Arial'; g.fillText(st.three, 116, 50);
      g.fillStyle = '#111'; g.font = 'bold 34px Arial'; g.fillText(st.no.slice(0, 2), 116, 92); g.fillText(st.no.slice(2), 116, 128);
    }
    g.fillStyle = '#1f9a48'; g.fillRect(0, 166, w, 40);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w / 2 - 14, 166); g.lineTo(w / 2 + 14, 166); g.lineTo(w / 2 + 14, 206); g.lineTo(w / 2 - 14, 206); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 26px "Hiragino Sans",sans-serif';
    if (prev) { g.textAlign = 'left'; g.fillText('◀ ' + prev.ja, 30, 196); }
    if (next) { g.textAlign = 'right'; g.fillText(next.ja + ' ▶', w - 30, 196); }
    g.fillStyle = '#111'; g.textAlign = 'center'; g.font = 'bold 32px Arial'; g.fillText(st.en, w / 2, 244);
    g.font = '22px Arial';
    if (prev) { g.textAlign = 'left'; g.fillText((prev.no ? prev.no + ' ' : '') + prev.en, 30, 240); }
    if (next) { g.textAlign = 'right'; g.fillText(next.en + (next.no ? ' ' + next.no : ''), w - 30, 240); }
  });
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .3, roughness: .5 });
}
function pillarSignMat(st) {
  const t = canvasTex(96, 384, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f9a48'; g.fillRect(0, 0, w, 14);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '900 62px "Hiragino Sans",sans-serif';
    st.ja.split('').forEach((c, i) => g.fillText(c, w / 2, 90 + i * 74));
    g.font = 'bold 15px Arial'; g.save(); g.translate(w / 2, h - 18); g.fillText(st.en, 0, 0); g.restore();
  });
  return new THREE.MeshStandardMaterial({ map: t, roughness: .5 });
}
function departureMat(st, platNo) {
  const t = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f9a48'; g.fillRect(0, 0, w, 30); g.fillStyle = '#fff'; g.font = 'bold 20px "Hiragino Sans",sans-serif'; g.textAlign = 'left';
    g.fillText(platNo === 1 ? '宇都宮線  宇都宮方面  Utsunomiya Line' : '宇都宮線  上野・東京方面  for Ueno・Tokyo', 12, 22);
    const now = new Date();
    const fmt = m => { const d = new Date(now.getTime() + m * 60000); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const rows = platNo === 1 ? [['普通', fmt(2), '宇都宮', '3両'], ['快速', fmt(14), '宇都宮', '3両']] : [['普通', fmt(5), '上野', '3両'], ['普通', fmt(19), '東京', '3両']];
    g.font = 'bold 34px "Hiragino Sans",Menlo,monospace';
    rows.forEach((r, i) => {
      const y = 76 + i * 50; g.fillStyle = i ? '#ff9a2e' : '#ff7a1a';
      g.textAlign = 'left'; g.fillText(r[0], 14, y); g.fillText(r[1], 110, y); g.fillText(r[2], 230, y);
      g.fillStyle = '#5ee87a'; g.textAlign = 'right'; g.fillText(r[3], w - 14, y);
    });
  });
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .9, roughness: .4 });
}

/* place a geometry at (s, lat, y above rail) with the track's heading (+ extra yaw) */
function placeGeo(geo, s, lat, y, yawExtra = 0) {
  const p = posAt(s, lat, y); geo.rotateY(yawAt(s) + yawExtra); geo.translate(p.x, p.y, p.z); return geo;
}
function buildStations() { STATIONS.forEach(buildStation); }
function buildStation(st) {
  const g = new THREE.Group();
  const s0 = st.s - TRACK.PLAT_HALF, s1 = st.s + TRACK.PLAT_HALF, { E, D, Y } = PLAT;
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  for (const side of [1, -1]) {
    const e = side * E, f = side * (E + D), mid = side * (E + D * .58);
    // slab
    const top = sweep([[e, Y], [f, Y]], s0, s1, 4, 0, { flip: side < 0, vLen: 4 });
    add(top, STMAT.top).receiveShadow = true;
    add(sweep(side > 0 ? [[e, -.6], [e, Y]] : [[e, Y], [e, -.6]], s0, s1, 4, 0), STMAT.side);
    add(sweep(side > 0 ? [[f, Y], [f, -.6]] : [[f, -.6], [f, Y]], s0, s1, 4, 0), STMAT.side);
    // canopy (butterfly roof on a row of columns)
    const c0 = st.s - 66, c1 = st.s + 66;
    const roofP = [[e + side * .1, 4.75], [mid, 4.35], [f + side * .5, 4.75]];
    const roof = add(sweep(side > 0 ? roofP : roofP.slice().reverse(), c0, c1, 6, 0), STMAT.roof); roof.castShadow = true;
    add(sweep(side > 0 ? [[e + .1, 4.6], [mid, 4.2], [f + .5, 4.6]] : [[f - .5, 4.6], [mid, 4.2], [e - .1, 4.6]], c0, c1, 6, 0), STMAT.roofUnder);
    const lights = [], cols = [], misc = [];
    for (let s = c0 + 6; s < c1; s += 12) {
      cols.push(placeGeo(new THREE.CylinderGeometry(.16, .16, 3.3, 10), s, mid, Y + 1.65));
      lights.push(placeGeo(new THREE.BoxGeometry(9, .06, .18), s, side * (E + 1.2), 4.33));
    }
    add(mergeGeometries(cols), STMAT.column).castShadow = true;
    add(mergeGeometries(lights), STMAT.light);
    // pillar signs on every other column
    const ps = pillarSignMat(st), pg = [];
    for (let s = c0 + 6; s < c1; s += 24) for (const fl of [0, Math.PI]) pg.push(placeGeo(new THREE.PlaneGeometry(.42, 1.7).translate(0, 0, .17), s, mid, Y + 1.9, fl));
    add(mergeGeometries(pg), ps);
    // hanging station name boards facing the track
    const sm = signMat(st);
    for (const ds of [-36, 30]) {
      const yawE = side > 0 ? 0 : Math.PI;
      add(placeGeo(new THREE.PlaneGeometry(3.6, .9).translate(0, 0, .05), st.s + ds, side * (E + 1.2), 3.85, yawE), sm);
      add(placeGeo(new THREE.BoxGeometry(3.7, .96, .08), st.s + ds, side * (E + 1.2), 3.85), STMAT.dark);
      for (const hx of [-1.6, 1.6]) misc.push(placeGeo(new THREE.CylinderGeometry(.02, .02, .5, 4).translate(hx, 0, 0), st.s + ds, side * (E + 1.2), 4.55));
    }
    // track number + departure board + exit sign + clock, hung across the platform
    const platNo = side > 0 ? 1 : 2;
    add(placeGeo(new THREE.PlaneGeometry(.7, .7), st.s - 10, side * (E + 1.0), 3.65, -Math.PI / 2), STMAT.trackNo[platNo - 1]);
    add(placeGeo(new THREE.PlaneGeometry(.7, .7), st.s - 10, side * (E + 1.0), 3.65, Math.PI / 2), STMAT.trackNo[platNo - 1]);
    const dm = departureMat(st, platNo);
    add(placeGeo(new THREE.PlaneGeometry(2.6, .8).translate(0, 0, .06), st.s + 6, side * (E + 2.2), 3.55, -Math.PI / 2), dm);
    add(placeGeo(new THREE.PlaneGeometry(2.6, .8).translate(0, 0, .06), st.s + 6, side * (E + 2.2), 3.55, Math.PI / 2), dm);
    add(placeGeo(new THREE.BoxGeometry(.1, .86, 2.66), st.s + 6, side * (E + 2.2), 3.55), STMAT.dark);
    add(placeGeo(new THREE.PlaneGeometry(1.8, .45).translate(0, 0, .03), st.s - 22, mid, 3.75, -Math.PI / 2), STMAT.exit);
    add(placeGeo(new THREE.PlaneGeometry(1.8, .45).translate(0, 0, .03), st.s - 22, mid, 3.75, Math.PI / 2), STMAT.exit);
    add(placeGeo(new THREE.CircleGeometry(.32, 20).translate(0, 0, .03), st.s + 22, mid, 3.75, -Math.PI / 2), STMAT.clock);
    add(placeGeo(new THREE.CircleGeometry(.32, 20).translate(0, 0, .03), st.s + 22, mid, 3.75, Math.PI / 2), STMAT.clock);
    // stair housing (down to the concourse)
    const stairLat = side * (E + D - 1.25);
    add(placeGeo(new THREE.BoxGeometry(16, 1.1, 2.3), st.s - 34, stairLat, Y + .55), STMAT.whiteStone);
    add(placeGeo(new THREE.BoxGeometry(16, .06, 2.3), st.s - 34, stairLat, Y + 1.12), STMAT.metal);
    add(placeGeo(new THREE.PlaneGeometry(2.1, .95).translate(0, 0, .02), st.s - 26, stairLat, Y + .5, Math.PI / 2), STMAT.dark);
    // benches + vending machines + bins
    for (const ds of [-52, 14, 44]) {
      misc.push(placeGeo(new THREE.BoxGeometry(2.2, .08, .45), st.s + ds, mid, Y + .45));
      misc.push(placeGeo(new THREE.BoxGeometry(2.2, .45, .06).translate(0, .25, side * .22), st.s + ds, mid, Y + .45));
    }
    add(mergeGeometries(misc), STMAT.metal);
    const benches = [];
    for (const ds of [-52, 14, 44]) benches.push(placeGeo(new THREE.BoxGeometry(2.0, .06, .42), st.s + ds, mid, Y + .5));
    add(mergeGeometries(benches), STMAT.bench);
    add(placeGeo(new THREE.BoxGeometry(1.0, 1.8, .75).translate(0, 0, 0), st.s - 6, side * (E + D - .5), Y + .9, side > 0 ? -Math.PI / 2 : Math.PI / 2), STMAT.vendR);
    add(placeGeo(new THREE.BoxGeometry(1.0, 1.8, .75), st.s - 4.9, side * (E + D - .5), Y + .9, side > 0 ? -Math.PI / 2 : Math.PI / 2), STMAT.vendB);
    // queue marks at each door of a train stopped on the "3" marker (player platform)
    if (side > 0) {
      const q = [];
      for (let i = 0; i < C205.cars; i++) for (const dx of C205.doors) {
        const ds = st.stopS - 10 - i * 20.5 + dx;
        for (const o of [-.9, .9]) q.push(placeGeo(new THREE.PlaneGeometry(.12, 1.2).rotateX(-Math.PI / 2), ds + o, E + 1.6, Y + .012));
      }
      add(mergeGeometries(q), STMAT.queue);
    }
  }
  // station building beside the line
  buildStationBuilding(st, g);
  if (st.big) buildScreenDoors(st, g);
  mergeStatic(g);
  g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  addToChunk(st.s, g);
  st.group = g;
}
function buildStationBuilding(st, g) {
  const side = st.big ? -1 : 1;      // small station buildings stand on the platform-1 side (the HU300 runs on the other)
  const lat = st.big ? -34 : (PLAT.E + PLAT.D + 7);
  const add = (geo, mat) => g.add(new THREE.Mesh(geo, mat));
  if (st.id === 'tokyo') {
    // red-brick station building with two domes
    add(placeGeo(new THREE.BoxGeometry(170, 15, 18).translate(0, 7.5, 0), st.s, lat - 6, GROUND - elevAt(st.s)), STMAT.brick);
    add(placeGeo(new THREE.BoxGeometry(171, 1.2, 19).translate(0, 4.5, 0), st.s, lat - 6, GROUND - elevAt(st.s)), STMAT.whiteStone);
    add(placeGeo(new THREE.BoxGeometry(171, 2.5, 19).translate(0, 16, 0), st.s, lat - 6, GROUND - elevAt(st.s)), STMAT.dome);
    for (const ds of [-70, 70]) {
      add(placeGeo(new THREE.CylinderGeometry(7, 7, 21, 8).translate(0, 10.5, 0), st.s + ds, lat - 6, GROUND), STMAT.brick);
      add(placeGeo(new THREE.SphereGeometry(7.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 21, 0), st.s + ds, lat - 6, GROUND), STMAT.dome);
    }
    add(placeGeo(new THREE.CylinderGeometry(9, 9, 22, 8).translate(0, 11, 0), st.s, lat - 6, GROUND), STMAT.brick);
    add(placeGeo(new THREE.ConeGeometry(9.5, 7, 8).translate(0, 25.5, 0), st.s, lat - 6, GROUND), STMAT.dome);
  } else {
    const L = st.big ? 120 : 26, Wd = st.big ? 22 : 9, H = st.big ? 20 : 7;
    add(placeGeo(new THREE.BoxGeometry(L, H, Wd).translate(0, H / 2, 0), st.s - 10, lat + side * Wd / 2, GROUND - elevAt(st.s)), st.big ? STMAT.glassBld : STMAT.whiteStone);
    add(placeGeo(new THREE.BoxGeometry(L + 1, .8, Wd + 1).translate(0, H, 0), st.s - 10, lat + side * Wd / 2, GROUND - elevAt(st.s)), STMAT.whiteStone);
    const nameT = textBoard([[st.ja + '駅', st.big ? 70 : 64, .4], [st.en.toUpperCase() + ' STATION', 26, .8]], { w: 512, h: 128, bg: st.big ? '#1f9a48' : '#ffffff', fg: st.big ? '#fff' : '#1f7a3f' });
    const nm = new THREE.MeshStandardMaterial({ map: nameT, emissive: 0xffffff, emissiveMap: nameT, emissiveIntensity: .2 });
    add(placeGeo(new THREE.PlaneGeometry(st.big ? 22 : 8, st.big ? 5.5 : 2), st.s - 10, lat - side * .05, GROUND - elevAt(st.s) + H - (st.big ? 4 : 1.6), side > 0 ? 0 : Math.PI), nm);
  }
}

/* ── platform screen doors (ホームドア): waist-high gates that open with the train doors ── */
const PSD = { lat: PLAT.E + .38, h: 1.3, gap: 2.0 };
function psdDoorS(st) { const out = []; for (let i = 0; i < C205.cars; i++) for (const dx of C205.doors) out.push(st.stopS - 10 - i * 20.5 + dx); return out.sort((a, b) => a - b); }
function buildScreenDoors(st, g) {
  if (!STMAT.psd) {
    STMAT.psd = new THREE.MeshStandardMaterial({ color: 0xe9ecee, roughness: .45, metalness: .2 });
    STMAT.psdTop = new THREE.MeshStandardMaterial({ color: 0x1f9a48, roughness: .5 });
    const gt = canvasTex(128, 160, (c, W, H) => {
      c.fillStyle = '#f7f8f9'; c.fillRect(0, 0, W, H); c.fillStyle = '#1f9a48'; c.fillRect(0, 0, W, 10);
      c.fillStyle = '#9fd0f0'; rrect(c, 16, 24, W - 32, 64, 8); c.fill();
      c.fillStyle = '#f2c522'; c.fillRect(0, H - 14, W, 6);
      c.fillStyle = '#e8401c'; c.font = 'bold 20px Arial'; c.textAlign = 'center'; c.fillText('⇦ ⇨', W / 2, 120);
    });
    STMAT.gate = new THREE.MeshStandardMaterial({ map: gt, roughness: .4 });
    STMAT.psdSign = new THREE.MeshStandardMaterial({ map: textBoard([['ホームドア', 30, .4], ['Platform Doors', 20, .78]], { w: 256, h: 64, bg: '#1f9a48', fg: '#fff' }), roughness: .5 });
  }
  const doors = psdDoorS(st), s0 = st.s - TRACK.PLAT_HALF + 1, s1 = st.s + TRACK.PLAT_HALF - 1;
  // fixed panels between the openings
  const edges = [s0]; doors.forEach(d => edges.push(d - PSD.gap / 2, d + PSD.gap / 2)); edges.push(s1);
  const fixed = [], tops = [], signs = [];
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i], b = edges[i + 1]; if (b - a < .2) continue;
    const mid = (a + b) / 2;
    fixed.push(placeGeo(new THREE.BoxGeometry(b - a, PSD.h, .26), mid, PSD.lat, PLAT.Y + PSD.h / 2));
    tops.push(placeGeo(new THREE.BoxGeometry(b - a, .07, .3), mid, PSD.lat, PLAT.Y + PSD.h + .03));
    if (b - a > 3) signs.push(placeGeo(new THREE.PlaneGeometry(1.2, .3).translate(0, 0, .135), mid, PSD.lat, PLAT.Y + .95));
  }
  g.add(new THREE.Mesh(mergeGeometries(fixed), STMAT.psd), new THREE.Mesh(mergeGeometries(tops), STMAT.psdTop), new THREE.Mesh(mergeGeometries(signs), STMAT.psdSign));
  // sliding gates (2 per opening) — instanced, animated with the train doors
  const gates = new THREE.InstancedMesh(new THREE.BoxGeometry(.98, PSD.h - .12, .1), STMAT.gate, doors.length * 2);
  gates.userData.dyn = true;
  st.psd = { gates, doors, k: -1 };
  setScreenDoors(st, 0);
  addToChunk(st.s, gates);
}
const _pg = new THREE.Object3D();
function setScreenDoors(st, k) {
  if (!st.psd || st.psd.k === k) return; st.psd.k = k;
  let i = 0;
  for (const d of st.psd.doors) for (const sg of [-1, 1]) {
    const s = d + sg * (.5 + .98 * k);
    posAt(s, PSD.lat, PLAT.Y + (PSD.h - .12) / 2 + .02, _pg.position); _pg.rotation.set(0, yawAt(s), 0); _pg.updateMatrix();
    st.psd.gates.setMatrixAt(i++, _pg.matrix);
  }
  st.psd.gates.instanceMatrix.needsUpdate = true;
}
