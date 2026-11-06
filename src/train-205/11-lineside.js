/* ═══ LINESIDE: signals, level crossings, signs ═══ */
const LMAT = {};
const SIGNALS = [], CROSSINGS = [];
function linesideMaterials() {
  LMAT.black = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: .6 });
  LMAT.mast = new THREE.MeshStandardMaterial({ color: 0x9da2a6, roughness: .6, metalness: .4 });
  LMAT.white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .6 });
  LMAT.barrier = new THREE.MeshStandardMaterial({ map: stripeTex('#f6d20c', '#141414', 10), roughness: .5 });
  LMAT.crossbuck = new THREE.MeshStandardMaterial({ map: stripeTex('#f6d20c', '#141414', 6), roughness: .5, side: THREE.DoubleSide });
  LMAT.road = new THREE.MeshStandardMaterial({ map: roadTex(), roughness: .95 });
  LMAT.rubber = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: .9 });
}
const LAMP_COL = { G: 0x22ff77, Y: 0xffb21a, R: 0xff2a1a };
let GLOW_TEX = null;
function glowMat(col) {
  if (!GLOW_TEX) GLOW_TEX = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  return new THREE.SpriteMaterial({ map: GLOW_TEX, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

/* ── colour-light signals: 4 lamps top→bottom  G, Y, R, Y ── */
function makeSignal(s, lat, facing, kind) {
  // facing +1: faces trains running +s (player side)
  const g = new THREE.Group();
  const base = posAt(s, lat, -.4); g.position.copy(base); g.rotation.y = yawAt(s) + (facing > 0 ? 0 : Math.PI);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, 5.2, 8), LMAT.mast); mast.position.y = 2.6; g.add(mast);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.28, 1.75, .62), LMAT.black); head.position.set(0, 5.4, 0); g.add(head);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.0, .9), LMAT.black); plate.position.set(-.16, 5.4, 0); g.add(plate);
  const cols = ['G', 'Y', 'R', 'Y'], lamps = [];
  for (let i = 0; i < 4; i++) {
    const y = 6.05 - i * .42;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.13, 16), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0, roughness: .2 }));
    lens.rotation.y = -Math.PI / 2; lens.position.set(-.19, y, 0); lens.userData.dyn = true; g.add(lens);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .22, 12, 1, true, 0, Math.PI), LMAT.black);
    hood.rotation.z = Math.PI / 2; hood.rotation.y = Math.PI / 2; hood.position.set(-.27, y + .02, 0); g.add(hood);
    const glow = new THREE.Sprite(glowMat(LAMP_COL[cols[i]])); glow.scale.set(1.3, 1.3, 1); glow.position.set(-.3, y, 0); glow.visible = false; g.add(glow);
    lamps.push({ lens, glow, col: LAMP_COL[cols[i]] });
  }
  // little number plate
  const np = new THREE.Mesh(new THREE.PlaneGeometry(.5, .3), new THREE.MeshStandardMaterial({ map: textBoard([[kind === 'dep' ? '出発' : kind === 'home' ? '場内' : '閉塞', 34, .5]], { w: 96, h: 56 }) }));
  np.rotation.y = -Math.PI / 2; np.position.set(-.13, 4.25, 0); g.add(np);
  mergeStatic(g);
  const sig = { s, facing, kind, g, lamps, aspect: '' };
  g.userData.dyn = true; setAspect(sig, 'G'); addToChunk(s, g); SIGNALS.push(sig);
  return sig;
}
function setAspect(sig, a) {
  if (sig.aspect === a) return; sig.aspect = a;
  const on = { G: [0], YG: [0, 1], Y: [1], YY: [1, 3], R: [2] }[a];
  sig.lamps.forEach((l, i) => {
    const lit = on.includes(i);
    l.lens.material.emissive.set(lit ? l.col : 0); l.lens.material.emissiveIntensity = lit ? 2 : 0;
    l.lens.material.color.set(lit ? l.col : 0x202020); l.glow.visible = lit;
  });
}
function buildSignals() {
  for (const st of STATIONS) {
    if (st.idx > 0) makeSignal(st.s - 330, TRACK.PLAYER + 2.7, 1, 'home');
    if (st.idx < STATIONS.length - 1) makeSignal(st.s + TRACK.PLAT_HALF + 12, TRACK.PLAYER + 1.9, 1, 'dep');
    // block signals in between
    if (st.idx < STATIONS.length - 1) {
      const a = st.s + 520, b = STATIONS[st.idx + 1].s - 650;
      const n = Math.max(1, Math.round((b - a) / 520));
      for (let i = 0; i <= n; i++) {
        const s = lerp(a, b, n ? i / n : 0);
        if (riverAt(s) || FEAT.rivers.some(r => Math.abs(r.s - s) < r.half + 15)) continue;
        makeSignal(s, TRACK.PLAYER + 2.7, 1, 'block');
        makeSignal(s + 40, TRACK.OPP - 2.7, -1, 'block');
      }
    }
  }
}
function updateSignals(trainS, camPos) {
  const rear = trainS - 61.5;
  for (const sg of SIGNALS) {
    // far away the lit lamp's glow is all you can see: skip the 4 lens meshes
    if (camPos) { const near = sg.g.position.distanceToSquared(camPos) < 230 * 230; if (near !== sg.lensOn) { sg.lensOn = near; sg.lamps.forEach(l => { l.lens.visible = near; }); } }
    if (sg.facing < 0) { if (!sg.aspect || sg.aspect === '') setAspect(sg, 'G'); continue; }
    if (sg.s > trainS) {
      // ahead: green, except the departure signal while we stand at the platform,
      // and the "caution" signals (a train ahead) in Regular mode
      const atPlat = sg.kind === 'dep' && sg.s - trainS < 150 && DRV.state !== 'go';
      const caution = sg.caution && !sg.cautionDone && G.mode === 'regular' && sg.s - trainS < 900;
      setAspect(sg, atPlat ? 'R' : caution ? (sg.s - trainS > 450 ? 'YG' : 'Y') : 'G');
    } else {
      // behind us: red while we are in the block, then yellow, yellow-green, green
      const d = rear - sg.s;
      setAspect(sg, d < 300 ? 'R' : d < 650 ? 'Y' : d < 1000 ? 'YG' : 'G');
    }
  }
}

/* ── level crossings (踏切): road, flashing lights, barriers, bell ── */
function buildCrossings() {
  for (const c of FEAT.crossings) {
    const g = new THREE.Group();
    // road across the tracks, ramping up to rail level
    const pos = [], uv = [], idx = [], p = new THREE.Vector3();
    const lats = []; for (let l = -320; l <= 320; l += 4) lats.push(l);
    lats.forEach((l, j) => {
      const [rmn, rmx] = extentsAt(c.s); const y = lerp(GROUND + .12, -.03, smooth(((l > 0 ? rmx : -rmn) + 10 - Math.abs(l)) / 8));
      for (const ds of [-3.2, 3.2]) { posG(c.s + ds, l, y, p); pos.push(p.x, p.y, p.z); uv.push(ds < 0 ? 0 : 1, l / 25); }
      if (j) { const a = (j - 1) * 2, b = a + 1, cc = a + 2, d = a + 3; idx.push(a, b, cc, b, d, cc); }
    });
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
    const road = new THREE.Mesh(rg, LMAT.road); road.receiveShadow = true; g.add(road);
    // rubber crossing panels between the rails
    for (const t of tracksAt(c.s)) {
      const pg = sweep([[t - .9, .005], [t + .9, .005]], c.s - 3.2, c.s + 3.2, 6.4, 0); g.add(new THREE.Mesh(pg, LMAT.rubber));
    }
    const units = [];
    const [cmn, cmx] = extentsAt(c.s);
    for (const [lat, ds, face] of [[cmx + 4.6, -3.9, 1], [cmn - 4.6, 3.9, -1]]) {
      const u = new THREE.Group(); posAt(c.s + ds, lat, -.4, u.position); u.rotation.y = yawAt(c.s) + (face > 0 ? 0 : Math.PI);
      // u: local -z faces the approaching road traffic, +x across the road
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 4.2, 8), LMAT.white); pole.position.y = 2.1; u.add(pole);
      for (const r of [.7, -.7]) { const cb = new THREE.Mesh(new THREE.BoxGeometry(1.5, .2, .03), LMAT.crossbuck); cb.position.set(0, 3.75, -.12); cb.rotation.z = r; u.add(cb); }
      const bp = new THREE.Mesh(new THREE.BoxGeometry(1.25, .42, .05), LMAT.black); bp.position.set(0, 2.85, -.12); u.add(bp);
      const lamps = [];
      for (const lx of [-.45, .45]) {
        const lens = new THREE.Mesh(new THREE.CircleGeometry(.16, 18), new THREE.MeshStandardMaterial({ color: 0x3a0806, emissive: 0, roughness: .3 }));
        lens.position.set(lx, 2.85, -.16); lens.rotation.y = Math.PI; lens.userData.dyn = true; u.add(lens);
        const glow = new THREE.Sprite(glowMat(0xff2a1a)); glow.scale.set(1.4, 1.4, 1); glow.position.set(lx, 2.85, -.3); glow.visible = false; u.add(glow);
        lamps.push({ lens, glow });
      }
      // ←→ direction indicator
      const ind = new THREE.Mesh(new THREE.BoxGeometry(.7, .22, .05), LMAT.black); ind.position.set(0, 2.4, -.12); u.add(ind);
      // barrier machine + arm (pivot at the machine)
      const mach = new THREE.Mesh(new THREE.BoxGeometry(.45, 1.0, .45), LMAT.white); mach.position.set(.6, .5, .3); u.add(mach);
      const piv = new THREE.Group(); piv.position.set(.6, 1.0, .3); u.add(piv);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5.6, .09, .09), LMAT.barrier); arm.position.x = 2.8; piv.add(arm);
      piv.rotation.z = Math.PI / 2 - .05;     // up
      mergeStatic(u);
      g.add(u); units.push({ lamps, piv });
    }
    // waiting cars
    const cars = [];
    for (const [lat, ds, dir] of [[cmx + 13, -1.6, -1], [cmn - 13, 1.6, 1], [cmx + 20, -1.6, -1]]) {
      const car = makeCar(pick([0xd8d8d8, 0x2f5ea8, 0xc23a2a, 0xf0f0f0, 0x333333, 0xe8c547]));
      posG(c.s + ds, lat, GROUND + .05, car.position); car.rotation.y = yawAt(c.s) + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.add(car); cars.push(car);
    }
    // horn sign (笛) 350 m before the crossing
    makeBoard(c.s - 350, TRACK.PLAYER + 2.6, '笛', { bg: '#fff', fg: '#111', border: '#111' });
    g.userData.dyn = true; addToChunk(c.s, g);
    CROSSINGS.push({ s: c.s, g, units, active: false, t: 0, arm: 0, bellT: 0 });
  }
}
function makeCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, .8, 1.75), new THREE.MeshStandardMaterial({ color, roughness: .35, metalness: .4 })); body.position.y = .65; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, .65, 1.6), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: .1, metalness: .5 })); cab.position.set(-.2, 1.35, 0); g.add(cab);
  const wg = new THREE.CylinderGeometry(.33, .33, .25, 12).rotateX(Math.PI / 2);
  for (const x of [-1.35, 1.35]) for (const z of [-.8, .8]) { const w = new THREE.Mesh(wg, LMAT.black); w.position.set(x, .33, z); g.add(w); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  mergeStatic(g);
  return g;
}
function updateCrossings(dt, trains, camPos) {
  for (const c of CROSSINGS) {
    let active = false;
    for (const tr of trains) {
      const head = tr.s, back = tr.dir > 0 ? tr.s - 61.5 : tr.s + 61.5;
      if (tr.dir > 0 && head > c.s - 330 && back < c.s + 8) active = true;
      if (tr.dir < 0 && head < c.s + 330 && back > c.s - 8) active = true;
    }
    if (active !== c.active) { c.active = active; c.t = 0; }
    c.t += dt;
    const flash = c.active || c.arm > .02;
    const ph = Math.floor(G.t * 2.4) % 2;
    c.units.forEach(u => u.lamps.forEach((l, i) => {
      const lit = flash && (i === ph);
      l.lens.material.emissive.set(lit ? 0xff2a1a : 0); l.lens.material.emissiveIntensity = lit ? 2.5 : 0; l.glow.visible = lit;
    }));
    // barriers come down 2 s after the lights start, go up once the train has passed
    const want = c.active && c.t > 2 ? 1 : 0;
    c.arm = clamp(c.arm + (want ? dt / 3.5 : -dt / 2.5), 0, 1);
    c.units.forEach(u => { u.piv.rotation.z = lerp(Math.PI / 2 - .05, 0, smooth(c.arm)); });
    // bell (カンカン)
    if (flash && c.g.parent && c.g.parent.visible) {
      const dd = camPos.distanceTo(posG(c.s, 0, 0, _cp));
      c.bellT -= dt;
      if (c.bellT <= 0 && dd < 420) {
        c.bellT = .42; const v = .16 * clamp(1 - dd / 420, 0, 1) ** 1.4;
        if (!playFile('crossing_bell', v * 5)) { tone(ph ? 760 : 700, .3, 'triangle', v); tone((ph ? 760 : 700) * 2.76, .15, 'sine', v * .35); }
      }
    }
  }
}
const _cp = new THREE.Vector3();

/* ── signs ── */
function makeBoard(s, lat, text, o = {}) {
  const g = new THREE.Group(); posAt(s, lat, -.4, g.position); g.rotation.y = yawAt(s) + (o.back ? Math.PI : 0);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, o.h || 2.4, 6), LMAT.mast); post.position.y = (o.h || 2.4) / 2; g.add(post);
  const sz = o.size || .8;
  const tex = textBoard(Array.isArray(text) ? text : [[text, 84, .54]], { w: 128, h: Math.round(128 * (o.aspect || 1)), bg: o.bg, fg: o.fg, border: o.border, bw: 7 });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz * (o.aspect || 1)), new THREE.MeshStandardMaterial({ map: tex, roughness: .5 }));
  b.rotation.y = -Math.PI / 2; b.position.set(-.06, (o.h || 2.4) + sz * (o.aspect || 1) / 2 - .1, 0); g.add(b);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(.04, sz * (o.aspect || 1), sz), LMAT.mast); bk.position.set(-.02, b.position.y, 0); g.add(bk);
  mergeStatic(g); addToChunk(s, g); return g;
}
function buildSigns() {
  // stop position markers on the platform edge ("3" = stop here with 3 cars)
  for (const st of STATIONS) {
    const pl = TRACK.PLAYER + 1.72;
    const mk = (ds, n, col) => {
      const g = new THREE.Group(); posAt(st.stopS + ds, pl, 1.1, g.position); g.rotation.y = yawAt(st.stopS);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.5, 6), LMAT.mast); post.position.y = .75; g.add(post);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), new THREE.MeshStandardMaterial({ map: textBoard([[n, 92, .55]], { bg: col, fg: col === '#fff' ? '#111' : '#fff', border: '#e8401c', bw: 10 }), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
      b.rotation.y = -Math.PI / 2; b.position.set(-.05, 1.75, 0); g.add(b);
      addToChunk(st.stopS, g);
    };
    mk(0, '3', '#fff'); mk(10, '4', '#2b6cc4'); mk(24, '6', '#2b6cc4');
    // station approach boards
    if (st.idx > 0) makeBoard(st.s - 600, TRACK.PLAYER + 2.7, [['駅', 70, .42], [st.en, 20, .82]], { bg: '#fff', fg: '#1f7a3f', border: '#1f7a3f' });
  }
  // speed limits before curves, horn signs before tunnels, km posts
  for (const c of CURVES) {
    const R2 = Math.abs(1 / c.k), lim = R2 < 700 ? 85 : R2 < 1000 ? 95 : 110;
    const s = c.s0 - 160; if (s < 50 || riverAt(s) || inTunnel(s)) continue;
    makeBoard(s, TRACK.PLAYER + 2.6, [[String(lim), 70, .55]], { bg: '#fff', fg: '#111', border: '#e8401c', size: .75 });
  }
  for (const t of FEAT.tunnels) makeBoard(t.a - 380, TRACK.PLAYER + 2.6, '笛', { bg: '#fff', fg: '#111', border: '#111' });
  for (let s = 500; s < TRACK.len; s += 500) {
    if (riverAt(s) || inTunnel(s)) continue;
    makeBoard(s, TRACK.PLAYER + 2.4, [[(s / 1000).toFixed(1), 50, .5]], { bg: '#fff', fg: '#111', h: .7, size: .45 });
  }
}
