/* ═══ WORLD: renderer, sky, light, airport, clouds, storms ═══ */
const W = {};               // world singletons
const GATE = { x: -150, z: -300, rotY: Math.PI / 2 };
const LINEUP = new THREE.Vector3(-300, 0, 0);
const TAXI_PTS = [[-110, -205], [-240, -205], [-330, -195], [-380, -140], [-382, -70], [-360, -18], [-300, 0]];

function initWorld() {
  if (W.ready) return; W.ready = true;
  buildBaseTextures(); baseMats();
  const r = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  $('gl').appendChild(r.domElement); W.renderer = r;
  const scene = new THREE.Scene(); W.scene = scene;
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .5;
  scene.fog = new THREE.Fog('#c4dbe9', 600, 12000);
  W.camera = new THREE.PerspectiveCamera(50, 1, .05, 150000);

  // sky dome
  W.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunSize: { value: 800 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100000, 32, 16), new THREE.ShaderMaterial({
    uniforms: W.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w*0.9999; }`,
    fragmentShader: `uniform vec3 top,hor,bot,sunCol,sunDir; uniform float sunSize; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h,0.,1.), 0.55)) : mix(hor, bot, clamp(-h*6.0,0.,1.));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, sunSize) * 4.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0)*0.08);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky); W.sky = sky;
  // stars
  const sp = []; for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(.02, 1), rnd(-1, 1)).normalize().multiplyScalar(90000); sp.push(v.x, v.y, v.z); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  W.stars.frustumCulled = false; scene.add(W.stars);

  W.sun = new THREE.DirectionalLight('#fff6e8', 2.6); W.sun.castShadow = true;
  W.sun.shadow.mapSize.set(2048, 2048); const sc = W.sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 1400;
  W.sun.shadow.bias = -.0004; W.sun.shadow.normalBias = .05;
  scene.add(W.sun, W.sun.target);
  W.hemi = new THREE.HemisphereLight('#bcd8ff', '#6b6a55', 1.0); scene.add(W.hemi);
  W.sunDir = new THREE.Vector3();
  W.cloudMat = new THREE.SpriteMaterial({ map: TEX.cloud, color: '#ffffff', transparent: true, depthWrite: false, fog: true });
  W.stormMat = new THREE.SpriteMaterial({ map: TEX.cloud, color: '#5b6070', transparent: true, depthWrite: false, fog: true });
  W.anvilMat = new THREE.SpriteMaterial({ map: TEX.cloud, color: '#9aa0ad', transparent: true, depthWrite: false, fog: true });
  setEnv(0, 0);
}

/* environment: k 0=day → 1=dusk, alt metres (camera height for fog) */
const ENV_DAY = { top: '#2c69b3', hor: '#c1def2', bot: '#8aa4b8', sun: '#fff6e8', sunI: 2.6, hs: '#bcd8ff', hg: '#6b6a55', hi: 1.0, el: 52, az: 35 };
const ENV_DUSK = { top: '#0c1736', hor: '#f0965a', bot: '#5a4a5a', sun: '#ffb27a', sunI: 2.0, hs: '#8a92c0', hg: '#6a5058', hi: 1.15, el: 4, az: 60 };
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function mixC(a, b, k) { return _c1.set(a).lerp(_c2.set(b), k); }
function setEnv(k, alt, overrides = {}) {
  const A = ENV_DAY, B = ENV_DUSK;
  W.skyU.top.value.copy(mixC(A.top, B.top, k)); W.skyU.hor.value.copy(mixC(A.hor, B.hor, k)); W.skyU.bot.value.copy(mixC(A.bot, B.bot, k));
  W.skyU.sunCol.value.copy(mixC(A.sun, B.sun, k)).multiplyScalar(lerp(.6, 1, k));
  const el = lerp(A.el, B.el, k) * DEG, az = lerp(A.az, B.az, k) * DEG;
  W.sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  W.skyU.sunDir.value.copy(W.sunDir); W.skyU.sunSize.value = lerp(900, 400, k);
  W.sun.color.copy(mixC(A.sun, B.sun, k)); W.sun.intensity = lerp(A.sunI, B.sunI, k) * (overrides.sunMul ?? 1);
  W.hemi.color.copy(mixC(A.hs, B.hs, k)); W.hemi.groundColor.copy(mixC(A.hg, B.hg, k)); W.hemi.intensity = lerp(A.hi, B.hi, k);
  W.stars.material.opacity = clamp((k - .55) * 2.2, 0, .85);
  W.scene.environmentIntensity = lerp(.55, .4, k);
  const altK = clamp(alt / 1500, 0, 1);
  W.scene.fog.color.copy(W.skyU.hor.value).lerp(_c2.set('#ffffff'), .08);
  W.scene.fog.near = overrides.fogNear ?? lerp(600, 4000, altK); W.scene.fog.far = overrides.fogFar ?? lerp(12000, 70000, altK);
  W.cloudMat.color.copy(mixC('#ffffff', '#ffd2b0', k));
  if (W.deck) W.deck.material.color.copy(mixC('#ffffff', '#f7c6a6', k));
  W.envK = k;
}
function aimSun(target) {
  W.sun.target.position.copy(target); W.sun.position.copy(target).addScaledVector(W.sunDir, 600);
}

/* ── ground ribbons (taxiways, lines) ── */
function ribbon(points, width, mat, y = .03) {
  const pos = [], uv = [], idx = []; let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[Math.min(i + 1, points.length - 1)], o = points[Math.max(i - 1, 0)];
    const d = new THREE.Vector3(q.x - o.x, 0, q.z - o.z).normalize(); const n = new THREE.Vector3(-d.z, 0, d.x);
    if (i) acc += p.distanceTo(points[i - 1]);
    pos.push(p.x + n.x * width / 2, y, p.z + n.z * width / 2, p.x - n.x * width / 2, y, p.z - n.z * width / 2);
    uv.push(acc / width, 0, acc / width, 1);
    if (i < points.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
function flatPlane(w, d, mat, x, z, y = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; return m; }

function buildAirport(al) {
  if (W.airport) { W.scene.remove(W.airport); }
  const G = new THREE.Group(); W.airport = G; W.scene.add(G);
  const grass = flatPlane(30000, 30000, new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 }), 1500, 0, -.05); G.add(grass);
  // runway
  const rwyMat = new THREE.MeshStandardMaterial({ map: TEX.runway.clone(), roughness: .9 });
  rwyMat.map.wrapS = THREE.RepeatWrapping; rwyMat.map.repeat.set(4000 / 60, 1); rwyMat.map.needsUpdate = true;
  const rwy = flatPlane(4000, 60, rwyMat, 1600, 0, .02); G.add(rwy);
  // threshold piano keys + numbers at the west (takeoff) end
  const th = makeCanvas(512, 512), tg = th.getContext('2d'); tg.drawImage(TEX.asphalt, 0, 0, 512, 512); tg.fillStyle = '#eeeeE8';
  for (let i = 0; i < 16; i++) if (i !== 7 && i !== 8) tg.fillRect(20, 16 + i * 30, 170, 18);
  tg.save(); tg.translate(370, 256); tg.rotate(Math.PI / 2); tg.font = 'bold 150px Helvetica'; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(al.rwy, 0, 0); tg.restore();
  const thr = flatPlane(60, 60, new THREE.MeshStandardMaterial({ map: canvasTex(th), roughness: .9 }), -370, 0, .03); G.add(thr);
  // taxiway path (curve shared with taxi animation)
  const taxiCurve = new THREE.CatmullRomCurve3(TAXI_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  W.taxiCurve = taxiCurve;
  const tPts = taxiCurve.getSpacedPoints(80);
  const taxiMat = new THREE.MeshStandardMaterial({ map: TEX.taxi, roughness: .95 }); TEX.taxi.wrapS = TEX.taxi.wrapT = THREE.RepeatWrapping;
  G.add(ribbon(tPts, 26, taxiMat, .015));
  G.add(ribbon(tPts, .35, new THREE.MeshBasicMaterial({ color: '#f2c200' }), .05));
  // parallel taxiway east
  G.add(ribbon([new THREE.Vector3(-240, 0, -205), new THREE.Vector3(1400, 0, -205)], 26, taxiMat, .015));
  G.add(ribbon([new THREE.Vector3(-240, 0, -205), new THREE.Vector3(1400, 0, -205)], .35, new THREE.MeshBasicMaterial({ color: '#f2c200' }), .05));
  // hold-short bars
  for (let i = 0; i < 4; i++) G.add(ribbon([new THREE.Vector3(-395, 0, -62 - i * .9), new THREE.Vector3(-368, 0, -62 - i * .9)], .25, new THREE.MeshBasicMaterial({ color: '#f2c200' }), .06));
  // apron
  const apron = flatPlane(700, 200, new THREE.MeshStandardMaterial({ map: TEX.concrete.clone(), roughness: .9 }), -140, -270, .01);
  apron.material.map.wrapS = apron.material.map.wrapT = THREE.RepeatWrapping; apron.material.map.repeat.set(70, 20); G.add(apron);
  // gate lead-in lines
  [-240, -150, -60].forEach(x => { G.add(ribbon([new THREE.Vector3(x, 0, -340), new THREE.Vector3(x, 0, -215)], .35, new THREE.MeshBasicMaterial({ color: '#f2c200' }), .05)); });
  // terminal
  const term = new THREE.Group(); G.add(term);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(760, 18, 60), stdMat('#d9d6cf', .8, .05)); tb.position.set(-150, 9, -392); tb.castShadow = tb.receiveShadow = true; term.add(tb);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(760, 12), new THREE.MeshStandardMaterial({ map: TEX.glass, roughness: .15, metalness: .6 })); glass.position.set(-150, 9, -361.9); term.add(glass);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(780, 1.2, 74), stdMat('#9aa3ad', .6, .4)); roof.position.set(-150, 18.6, -390); roof.castShadow = true; term.add(roof);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshBasicMaterial({ map: canvasTex(textCanvas(al.apt + ' INTERNATIONAL', { w: 1024, h: 102, font: 'bold 70px Helvetica', color: '#fff', bg: '#203a5c' })) }));
  sign.position.set(-150, 22.5, -361); term.add(sign);
  // gate numbers
  [-240, -150, -60].forEach((x, i) => { const n = i === 1 ? al.gate : String(i === 0 ? +al.gate.replace(/\D/g, '') - 1 || 1 : +al.gate.replace(/\D/g, '') + 1);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: canvasTex(textCanvas(n, { w: 256, h: 128, font: 'bold 90px Helvetica', color: '#111', bg: '#ffd200' })) }));
    s2.position.set(x + 25, 16, -361.5); term.add(s2); });
  // control tower
  const tw = new THREE.Group(); tw.position.set(260, 0, -470); G.add(tw);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 60, 16), stdMat('#cfd2d4', .7, .1)); shaft.position.y = 30; shaft.castShadow = true; tw.add(shaft);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(10, 7, 7, 12), new THREE.MeshStandardMaterial({ color: '#3a5f78', roughness: .1, metalness: .7 })); cab.position.y = 64; tw.add(cab);
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 1.5, 12), stdMat('#ddd', .6, .2)); capT.position.y = 68; tw.add(capT);
  // hangars
  [[600, -420], [760, -420]].forEach(([x, z]) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 120, 20, 1, false, 0, Math.PI), stdMat('#b8bec4', .6, .4));
    h.rotation.z = Math.PI / 2; h.rotation.y = Math.PI / 2; h.position.set(x, 0, z); h.castShadow = true; G.add(h); });
  // runway edge lights
  const lg = new THREE.SphereGeometry(.35, 6, 4), lm = new THREE.MeshBasicMaterial({ color: '#fff8e0' });
  const cnt = Math.floor(4000 / 60) * 2; const il = new THREE.InstancedMesh(lg, lm, cnt); let k = 0; const m4 = new THREE.Matrix4();
  for (let x = -400; x < 3600 && k < cnt - 1; x += 60) { m4.makeTranslation(x, .3, 31.5); il.setMatrixAt(k++, m4); m4.makeTranslation(x, .3, -31.5); il.setMatrixAt(k++, m4); }
  G.add(il);
  const gl2 = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: '#30ff70' }), 12); for (let i = 0; i < 12; i++) { m4.makeTranslation(-401, .3, -27 + i * 5); gl2.setMatrixAt(i, m4); } G.add(gl2);
  // trees + distant hills
  const treeG = new THREE.ConeGeometry(4, 12, 6).translate(0, 6, 0), tm = stdMat('#2f5a2c', 1, 0);
  const trees = new THREE.InstancedMesh(treeG, tm, 500); let ti = 0;
  while (ti < 500) { const x = rnd(-3000, 6000), z = rnd(-3500, 3500); if (z > -600 && z < 300) continue; const s = rnd(.7, 1.6);
    m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); trees.setMatrixAt(ti++, m4); }
  trees.castShadow = false; G.add(trees);
  const hillM = stdMat('#5d7a5a', 1, 0);
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, R = rnd(7000, 10000); const h = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hillM);
    h.scale.set(rnd(900, 2000), rnd(250, 700), rnd(900, 2000)); h.position.set(1500 + Math.cos(a) * R, -40, Math.sin(a) * R); G.add(h); }
  // ground vehicles near the gate (baggage tractor + carts, catering truck)
  const veh = new THREE.Group(); G.add(veh);
  const yellow = stdMat('#e8b923', .6, .2), white = stdMat('#f2f2f2', .6, .1);
  const tractor = new THREE.Group(); box(3, 1.4, 1.6, yellow, 0, .9, 0, tractor); box(1.2, 1, 1.5, stdMat('#333', .5, .2), -.6, 2, 0, tractor); tractor.position.set(-120, 0, -322); veh.add(tractor);
  for (let i = 0; i < 3; i++) { const cart = new THREE.Group(); box(3, 1.6, 1.8, stdMat('#6b7884', .7, .3), 0, 1.3, 0, cart); box(3.2, .2, 2, MAT.dark, 0, .4, 0, cart); cart.position.set(-124.5 - i * 3.8, 0, -322); veh.add(cart); }
  const cat = new THREE.Group(); box(4, 2.2, 2.4, white, 2.5, 1.4, 0, cat); box(6, 3.2, 2.5, white, -2.8, 4.2, 0, cat); box(6, .4, 2.6, MAT.dark, -2.8, 2.4, 0, cat);
  cat.position.set(-128, 0, -268); cat.rotation.y = Math.PI / 2; veh.add(cat);
  W.vehicles = veh;
  // jet bridge + tug + neighbours built by buildGateStuff()
  return G;
}
function buildJetBridge(doorWorld) {
  const g = new THREE.Group(); W.airport.add(g);
  const R = new THREE.Vector3(doorWorld.x - 22, doorWorld.y, -364);
  const rot = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 5, 16), stdMat('#c9c9c4', .7, .2)); rot.position.copy(R); rot.castShadow = true; g.add(rot);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, R.y, 10), stdMat('#888', .6, .4)); post.position.set(R.x, R.y / 2, R.z); g.add(post);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(1, 3.2, 3), new THREE.MeshStandardMaterial({ color: '#dcdcd6', roughness: .6, metalness: .2 })); tunnel.castShadow = true; g.add(tunnel);
  const cabG = new THREE.Group(); g.add(cabG);
  box(3.4, 3.6, 4.2, stdMat('#cfcfc9', .6, .2), 0, 0, 0, cabG);
  box(.3, 3.0, 3.2, stdMat('#2a2a2a', .9, 0), 1.8, -.1, 0, cabG); // bellows
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, doorWorld.y - 1.5, 8), stdMat('#888', .6, .5)); g.add(leg);
  const wheels = box(1.2, .8, 2.5, MAT.dark, 0, .4, 0, g);
  const dock = new THREE.Vector3(doorWorld.x - 1.9, doorWorld.y + .9, doorWorld.z), park = dock.clone().add(new THREE.Vector3(-7, 0, -6));
  const api = { group: g, set(p) {
    const end = park.clone().lerp(dock, smooth(p)); const d = end.clone().sub(R); d.y = 0; const len = d.length() - 1.5;
    tunnel.scale.x = len; tunnel.position.copy(R).addScaledVector(d.clone().normalize(), 1.5 + len / 2); tunnel.position.y = end.y;
    tunnel.rotation.y = Math.atan2(-d.z, d.x);
    cabG.position.copy(end);
    leg.position.set(end.x - 1.5, (end.y - 1.5) / 2 + .5, end.z); wheels.position.set(end.x - 1.5, .4, end.z);
  } };
  api.set(1); return api;
}
function buildTug() {
  const g = new THREE.Group(); const yellow = stdMat('#f0c419', .55, .2);
  box(6.5, 1.3, 3.0, yellow, 0, 1.0, 0, g); box(1.6, 1.4, 2.4, stdMat('#2b3a4a', .2, .6), -1.8, 2.3, 0, g);
  [[-2.2, 1.3], [2.2, 1.3], [-2.2, -1.3], [2.2, -1.3]].forEach(([x, z]) => { const w = wheel(.55, .5); w.position.set(x, .55, z); g.add(w); });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 5.2, 8), stdMat('#d23', .5, .3)); bar.rotation.z = Math.PI / 2; bar.position.set(-5.8, .6, 0); g.add(bar);
  const beacon = glowSprite('#ffae00', 1.4); beacon.position.set(-1.8, 3.2, 0); g.add(beacon); g.userData.beacon = beacon;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* ── clouds ── */
function cloudClump(mat, size, n = 9, flat = .45) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(mat); const k = rnd(.55, 1.1) * size;
    s.scale.set(k, k * rnd(.6, .9), 1); s.position.set(rnd(-1, 1) * size * .7, rnd(-.3, .5) * size * flat, rnd(-1, 1) * size * .7);
    s.material.rotation = rnd(0, 6); g.add(s); }
  return g;
}
// field of puffy clouds around a centre that recycles as the plane moves
function cloudField({ count, yMin, yMax, radius, size, mat }) {
  const G = new THREE.Group(); W.scene.add(G); const items = [];
  for (let i = 0; i < count; i++) { const c = cloudClump(mat, rnd(size * .6, size * 1.3)); c.position.set(rnd(-radius, radius), rnd(yMin, yMax), rnd(-radius, radius)); G.add(c); items.push(c); }
  return { group: G, items, radius,
    recycle(center, dir) { items.forEach(c => { const dx = c.position.x - center.x, dz = c.position.z - center.z;
      if (dx * dx + dz * dz > radius * radius) { const a = Math.atan2(dir.z, dir.x) + rnd(-1.1, 1.1), r = radius * rnd(.75, .98);
        c.position.x = center.x + Math.cos(a) * r; c.position.z = center.z + Math.sin(a) * r; } }); },
    dispose() { W.scene.remove(G); } };
}
function cloudDeck(y, size = 160000, tile = 9000) {
  const mat = new THREE.MeshStandardMaterial({ map: TEX.deck, alphaMap: null, transparent: true, depthWrite: false, roughness: 1, color: '#ffffff', emissive: '#556070', emissiveIntensity: .25 });
  mat.map = TEX.deck.clone(); mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping; mat.map.repeat.set(size / tile, size / tile); mat.map.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -1;
  const under = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: '#c9ccd2', fog: true })); under.rotation.x = -Math.PI / 2; under.position.y = y - 120;
  const g = new THREE.Group(); g.add(m, under); W.scene.add(g); W.deck = m;
  return { group: g, mesh: m, follow(p) { g.position.x = p.x; g.position.z = p.z;
    mat.map.offset.set(p.x / tile, -p.z / tile); } };
}
/* ── storm cell (cumulonimbus) ── */
function stormCell(radius, base, topY) {
  const g = new THREE.Group();
  const coreM = new THREE.MeshStandardMaterial({ color: '#4a4f5c', roughness: 1, transparent: true, opacity: .92, fog: true });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * .55, radius * .8, topY - base, 18, 6, true), coreM); core.position.y = (topY + base) / 2; g.add(core);
  const h = topY - base;
  for (let i = 0; i < 46; i++) { const t = i / 46; const s = new THREE.Sprite(W.stormMat); const sz = radius * rnd(.7, 1.2);
    s.scale.set(sz, sz, 1); const a = rnd(0, 6.28), r = radius * rnd(.2, .75) * (1 - t * .3);
    s.position.set(Math.cos(a) * r, base + t * h, Math.sin(a) * r); g.add(s); }
  for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(W.anvilMat); const sz = radius * rnd(1.0, 1.6); s.scale.set(sz, sz * .5, 1);
    const a = rnd(0, 6.28), r = radius * rnd(.4, 1.35); s.position.set(Math.cos(a) * r, topY + rnd(-400, 300), Math.sin(a) * r); g.add(s); }
  const flash = new THREE.PointLight('#cfe0ff', 0, radius * 5, 1); flash.position.y = base + h * .5; g.add(flash);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#d8e6ff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  glow.scale.set(radius * 2.5, radius * 3, 1); glow.position.y = base + h * .45; g.add(glow);
  g.userData = { radius, base, topY, flash, glow, nextBolt: rnd(1, 4), bolt: 0 };
  return g;
}
function tickStorm(cell, dt, nearPlane) {
  const u = cell.userData; u.nextBolt -= dt;
  if (u.nextBolt <= 0) { u.bolt = .25; u.nextBolt = rnd(1.2, 4.5); if (nearPlane) sfx('thunder', .7); }
  u.bolt = Math.max(0, u.bolt - dt); const on = u.bolt > 0 && (u.bolt > .18 || (u.bolt < .1 && u.bolt > .05));
  u.flash.intensity = on ? 4e6 : 0; u.glow.material.opacity = on ? .55 : 0;
}
