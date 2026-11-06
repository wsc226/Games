/* ═══ WORLD: renderer, sky, light, ground, chunks, stations, scenery ═══ */
const W = { renderer: null, scene: null, camera: null, sun: null };
const SKY_TOP = new THREE.Color(0x3d86d8), SKY_HOR = new THREE.Color(0xcfe6f7);

function initWorld() {
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  $('gl').appendChild(r.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HOR, 420, 1500);
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .55;
  const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .6, 4000);
  Object.assign(W, { renderer: r, scene, camera: cam });
  // sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: SKY_TOP }, hor: { value: SKY_HOR } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h,.55)); gl_FragColor = vec4(c,1.); }',
  });
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat); scene.add(W.sky);
  // clouds (soft sprites)
  const ct = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 14; i++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, rr2 = 18 + Math.random() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr2); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  });
  W.clouds = new THREE.Group(); scene.add(W.clouds);
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: .9 }));
    const a = i / 26 * Math.PI * 2 + Math.random() * .2, d = 1500 + Math.random() * 900;
    sp.position.set(Math.cos(a) * d, 260 + Math.random() * 380, Math.sin(a) * d); sp.scale.set(700 + Math.random() * 500, 300 + Math.random() * 150, 1);
    W.clouds.add(sp);
  }
  // light
  W.hemi = new THREE.HemisphereLight(0xdfefff, 0x5a6b45, 1.1); scene.add(W.hemi);
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .04;
  scene.add(sun, sun.target); W.sun = sun;
  addEventListener('resize', onResize);
}
function onResize() {
  W.renderer.setSize(innerWidth, innerHeight);
  W.camera.aspect = innerWidth / innerHeight; W.camera.updateProjectionMatrix();
}
const SUN_DIR = new THREE.Vector3(-.45, .78, .42).normalize();
function followSun(target) {
  W.sun.target.position.copy(target);
  W.sun.position.copy(target).addScaledVector(SUN_DIR, 200);
  W.sky.position.copy(W.camera.position); W.clouds.position.set(W.camera.position.x, 0, W.camera.position.z);
}

/* ── ground ── */
function buildGround() {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < TRACK.n; i += 50) { minX = Math.min(minX, TRACK.px[i]); maxX = Math.max(maxX, TRACK.px[i]); minZ = Math.min(minZ, TRACK.pz[i]); maxZ = Math.max(maxZ, TRACK.pz[i]); }
  const pad = 3000, w = maxX - minX + pad * 2, d = maxZ - minZ + pad * 2;
  const t = grassTex(); t.repeat.set(w / 14, d / 14);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));
  g.position.set((minX + maxX) / 2, -.62, (minZ + maxZ) / 2); g.receiveShadow = true; W.scene.add(g);
}

/* ── chunks ── */
const WMAT = {};
function worldMaterials() {
  WMAT.platform = new THREE.MeshStandardMaterial({ map: platformTopTex(), roughness: .9 });
  WMAT.platSide = new THREE.MeshStandardMaterial({ color: 0xa9a6a0, roughness: .95 });
  WMAT.canopy = new THREE.MeshStandardMaterial({ color: 0x7c8086, roughness: .6, metalness: .3, side: THREE.DoubleSide });
  WMAT.post = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .6 });
  WMAT.urban = new THREE.MeshStandardMaterial({ color: 0x67665f, roughness: 1 });
  WMAT.facade = new THREE.MeshStandardMaterial({ map: facadeTex(), vertexColors: true, roughness: .8 });
  WMAT.house = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  WMAT.trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 });
  WMAT.crown = new THREE.MeshStandardMaterial({ color: 0x3f7f35, roughness: 1, flatShading: true });
  WMAT.paddy = new THREE.MeshStandardMaterial({ color: 0x8fbf4a, roughness: 1 });
  WMAT.paddy2 = new THREE.MeshStandardMaterial({ color: 0xa9c860, roughness: 1 });
}
function buildChunks() {
  for (let s0 = 0; s0 < TRACK.len; s0 += CHUNK) {
    const s1 = Math.min(s0 + CHUNK, TRACK.len);
    const group = new THREE.Group();
    buildTrackChunk(s0, s1, group);
    buildStructures(s0, s1, group);
    buildShkChunk(s0, s1, group);
    buildScenery(s0, s1, group);
    const c = posAt((s0 + s1) / 2, 0, 0);
    W.scene.add(group);
    chunks.push({ s0, s1, group, center: c });
  }
}
let CHUNK_FAR = 1750;
function updateChunks() {
  const p = W.camera.position;
  for (const c of chunks) c.group.visible = c.center.distanceTo(p) < CHUNK_FAR;
  updateExtras();
}

/* ── scenery scatter ── */
function boxUV(geo, sx, sy, sz) {
  // scale UVs so the facade texture tiles per 4 m bay / 3.5 m storey
  const uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)) > .5, ay = Math.abs(n.getY(i)) > .5;
    const u = uv.getX(i) * (ax ? sz : sx) / 4, v = uv.getY(i) * (ay ? sz : sy) / 3.5;
    uv.setXY(i, ay ? 0 : u, ay ? 0 : v);
  }
}
function colorGeo(geo, col) {
  const c = new THREE.Color(col), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
const TREE_TRUNK = new THREE.CylinderGeometry(.18, .26, 2.4, 6).translate(0, 1.2, 0);
const TREE_CROWN = new THREE.IcosahedronGeometry(2.2, 0).translate(0, 4.2, 0);
// true when something placed at |lat| with half-size r would hit the railway corridor
function clearFor(s, alat, r, lat = null) {
  if (lat !== null && typeof shkOff === 'function' && SHK.pts && shkBlocked(clamp(s, 0, TRACK.len), lat, r)) return true;
  const [mn, mx] = extentsAt(clamp(s, 0, TRACK.len));
  const e = elevAt(s), edge = Math.max(Math.abs(mn), Math.abs(mx)) + 7 + 1.6 * e;
  if (alat - r < edge + 4) return true;
  if (FEAT.crossings.some(c => Math.abs(c.s - s) < 10 + r)) return true;
  if (typeof raceOff === 'function' && Math.abs(-alat - raceOff(clamp(s, 0, TRACK.len))) < r + 7) return true;
  if (STATIONS.some(st => Math.abs(st.s - s) < (st.id === 'tokyo' ? 110 : st.big ? 80 : 30) + r && alat - r < (st.big ? 62 : 26))) return true;
  return false;
}
function nearStation(s, pad = 140) { return STATIONS.some(st => Math.abs(st.s - s) < TRACK.PLAT_HALF + pad); }
function buildScenery(s0, s1, group) {
  R = mulberry(Math.floor(s0) + 99);
  const zone = zoneAt((s0 + s1) / 2);
  const p = new THREE.Vector3();
  const blds = [], houses = [], trees = [];
  // urban ground strip
  if (zone === 'city') {
    const strip = new THREE.Mesh(sweep([[-260, GROUND + .08, 1], [260, GROUND + .08, 1]], s0, s1, 20, 0, { flip: false }), WMAT.urban);
    strip.receiveShadow = true; group.add(strip);
  }
  const place = (minLat, maxLat) => { const s = rr(s0, s1), lat = rr(minLat, maxLat) * (R() < .5 ? -1 : 1); return { s, lat }; };
  if (zone === 'city') {
    for (let i = 0; i < 46; i++) {
      const { s, lat } = place(16, 240);
      const w = rr(10, 24), d = rr(10, 22), h = rr(9, Math.abs(lat) > 60 ? 70 : 32);
      blds.push({ s, lat, w, d, h, col: pick(['#f1efe8', '#e3e0d6', '#d6d9dc', '#efe6d2', '#cfd4d9', '#e8dccb', '#c9c2b5']) });
    }
  } else if (zone === 'suburb') {
    for (let i = 0; i < 34; i++) { const { s, lat } = place(16, 200); houses.push({ s, lat }); }
    for (let i = 0; i < 6; i++) { const { s, lat } = place(30, 220); blds.push({ s, lat, w: rr(10, 18), d: rr(10, 16), h: rr(8, 18), col: pick(['#f1efe8', '#e3e0d6', '#efe6d2']) }); }
    for (let i = 0; i < 30; i++) { const { s, lat } = place(14, 260); trees.push({ s, lat, k: rr(.8, 1.4) }); }
  } else {
    for (let i = 0; i < 10; i++) { const { s, lat } = place(20, 200); houses.push({ s, lat }); }
    for (let i = 0; i < 70; i++) { const { s, lat } = place(14, 320); trees.push({ s, lat, k: rr(.8, 1.6) }); }
    // rice paddies
    for (let i = 0; i < 4; i++) {
      const s = rr(s0, s1 - 40), lat = rr(18, 120) * (R() < .5 ? -1 : 1), wv = rr(25, 45), dl = rr(20, 40);
      if (inHill(s, lat) || inRiver(posG(s, lat).x, posG(s, lat).z, 30) || clearFor(s, Math.abs(lat), 30, lat)) continue;
      const pg = sweep([[lat, GROUND + .14, 1], [lat + (lat > 0 ? dl : -dl), GROUND + .14, 1]], s, Math.min(s + wv, s1), wv, 0, { flip: lat < 0 });
      const m = new THREE.Mesh(pg, R() < .5 ? WMAT.paddy : WMAT.paddy2); m.receiveShadow = true; group.add(m);
    }
  }
  if (blds.length) {
    const geos = [];
    for (const b of blds) {
      if (clearFor(b.s, Math.abs(b.lat), b.d / 2 + 4, b.lat) || (nearStation(b.s, 20) && Math.abs(b.lat) < b.d / 2 + 22)) continue;
      const g = new THREE.BoxGeometry(b.w, b.h, b.d); boxUV(g, b.w, b.h, b.d); colorGeo(g, b.col);
      posG(b.s, b.lat, GROUND + b.h / 2, p);
      if (inRiver(p.x, p.z, b.w) || inHill(b.s, b.lat)) continue;
      g.rotateY(yawAt(b.s)); g.translate(p.x, p.y, p.z); geos.push(g);
    }
    if (geos.length) { const m = new THREE.Mesh(mergeGeometries(geos), WMAT.facade); m.castShadow = m.receiveShadow = true; group.add(m); }
  }
  if (houses.length) {
    const geos = [];
    for (const hs of houses) {
      if (clearFor(hs.s, Math.abs(hs.lat), 6, hs.lat) || (nearStation(hs.s, 10) && Math.abs(hs.lat) < 22) || inHill(hs.s, hs.lat)) continue;
      { const q = posG(hs.s, hs.lat); if (inRiver(q.x, q.z, 10)) continue; }
      const w = rr(7, 10), d = rr(6, 9), h = rr(5, 6.5);
      const body = colorGeo(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), pick(['#f3efe4', '#e9e2d0', '#f7f4ec', '#dcd3c0', '#c9d3d8']));
      const rr3 = (d + .6) / 1.732;
      const roofG = new THREE.CylinderGeometry(rr3, rr3, w + .6, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
      roofG.scale(1, .6, 1); roofG.translate(0, h + .5 * rr3 * .6, 0);
      const roof = colorGeo(roofG.toNonIndexed(), pick(['#5a6670', '#7a3b2e', '#3c4a5a', '#6b6f73', '#2f5d7c']));
      const hg = mergeGeometries([body.toNonIndexed(), roof]);
      posG(hs.s, hs.lat, GROUND, p); hg.rotateY(yawAt(hs.s) + (R() < .3 ? Math.PI / 2 : 0)); hg.translate(p.x, p.y, p.z); geos.push(hg);
    }
    if (geos.length) { const m = new THREE.Mesh(mergeGeometries(geos), WMAT.house); m.castShadow = m.receiveShadow = true; group.add(m); }
  }
  if (trees.length) {
    const ok = trees.filter(t => !clearFor(t.s, Math.abs(t.lat), 3, t.lat) && !(nearStation(t.s, 10) && Math.abs(t.lat) < 22) && !inHill(t.s, t.lat) && !(() => { const q = posG(t.s, t.lat); return inRiver(q.x, q.z, 5); })());
    const tr = new THREE.InstancedMesh(TREE_TRUNK, WMAT.trunk, ok.length), cr = new THREE.InstancedMesh(TREE_CROWN, WMAT.crown, ok.length);
    const o = new THREE.Object3D(), col = new THREE.Color();
    ok.forEach((t, i) => {
      posG(t.s, t.lat, GROUND, o.position); o.rotation.set(0, R() * 6, 0); o.scale.setScalar(t.k); o.updateMatrix();
      tr.setMatrixAt(i, o.matrix); cr.setMatrixAt(i, o.matrix);
      cr.setColorAt(i, col.setHSL(.27 + R() * .06, .45 + R() * .15, .26 + R() * .1));
    });
    cr.castShadow = true; group.add(tr, cr);
  }
}
