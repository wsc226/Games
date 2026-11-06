/* ═══ PEOPLE: waiting passengers, getting off and on ═══
   Positions are kept in track coordinates (s, lat) on the platform (y = PLAT.Y). */
const PEOPLE = { list: [], mat: null, imat: null, variants: null, crowds: {} };
const SKIN = ['#f1c8a5', '#e0ac85', '#c98e66', '#f6d7bd'];
const SHIRT = ['#e8443a', '#3a78d8', '#f2c230', '#3aa860', '#ffffff', '#8a5ac8', '#f08a24', '#2b2f3a', '#e86aa0', '#6fc3e6', '#c7c7c7'];
const PANTS = ['#2a3348', '#3b3b3b', '#5a4a3a', '#20252c', '#6a7280', '#1f3f6a'];
const HAIR = ['#1b1612', '#2b1f17', '#4a3324', '#111111', '#7a7a7a'];
function personGeometry(kid, pose = 'stand', tint = false) {
  // origin: feet (stand / hold) or seat surface under the hips (sit); faces +z
  const k = kid ? .68 : 1, parts = [];
  const box = (w, h, d, x, y, z, col) => parts.push(colorGeo(new THREE.BoxGeometry(w * k, h * k, d * k).translate(x * k, y * k, z * k).toNonIndexed(), col));
  const pants = pick(PANTS), shirt = tint ? '#ff00ff' : pick(SHIRT), skin = pick(SKIN);   // magenta = per-person shirt colour
  let top = 0;   // y of the hips
  if (pose === 'sit') {
    box(.14, .14, .46, -.09, .07, .2, pants); box(.14, .14, .46, .09, .07, .2, pants);       // thighs
    box(.13, .46, .14, -.09, -.2, .42, pants); box(.13, .46, .14, .09, -.2, .42, pants);     // shins
    box(.11, .07, .24, -.09, -.46, .48, '#222'); box(.11, .07, .24, .09, -.46, .48, '#222');  // shoes
    box(.1, .4, .11, -.27, .38, .05, shirt); box(.1, .4, .11, .27, .38, .05, shirt);         // arms
    box(.1, .08, .26, -.2, .18, .22, shirt); box(.1, .08, .26, .2, .18, .22, shirt);         // forearms on the lap
    top = .02;
  } else {
    box(.14, .8, .17, -.09, .4, 0, pants); box(.14, .8, .17, .09, .4, 0, pants);             // legs
    box(.11, .07, .24, -.09, .035, .04, '#222'); box(.11, .07, .24, .09, .035, .04, '#222'); // shoes
    box(.1, .56, .11, -.27, 1.1, 0, shirt); box(.09, .09, .09, -.27, .79, 0, skin);
    if (pose === 'hold') { box(.1, .56, .11, .27, 1.66, 0, shirt); box(.09, .09, .09, .27, 1.97, 0, skin); }
    else { box(.1, .56, .11, .27, 1.1, 0, shirt); box(.09, .09, .09, .27, .79, 0, skin); }
    top = .8;
  }
  box(.42, .62, .24, 0, top + .31, 0, shirt);                                                 // body
  parts.push(colorGeo(new THREE.SphereGeometry(.13 * k, 10, 8).translate(0, (top + .76) * k, 0).toNonIndexed(), skin));
  parts.push(colorGeo(new THREE.SphereGeometry(.14 * k, 10, 6, 0, Math.PI * 2, 0, Math.PI * .55).translate(0, (top + .78) * k, -.01 * k).toNonIndexed(), pick(HAIR)));
  if (pose !== 'sit' && R() < .35) box(.3, .34, .14, 0, top + .35, -.19, pick(['#222', '#4a3a2a', '#2f5ea8', '#c23a2a']));   // backpack
  if (pose === 'stand' && R() < .15) box(.34, .5, .2, .38, .28, 0, pick(['#333', '#4a5a6a', '#8a2a2a']));                   // suitcase
  for (const g of parts) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  return mergeGeometries(parts);
}
function makePerson(kid) {
  if (!PEOPLE.mat) PEOPLE.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  const m = new THREE.Mesh(personGeometry(kid), PEOPLE.mat); m.castShadow = false;
  return m;
}
/* Station crowds are instanced: 8 body shapes, each one InstancedMesh per station,
   and every person gets their own shirt colour (magenta in the geometry → instance colour). */
const PV = 8, PCAP = 40, _pO = new THREE.Object3D(), _pC = new THREE.Color(), _pZero = new THREE.Matrix4().makeScale(0, 0, 0);
function crowdFor(st) {
  if (PEOPLE.crowds[st.id]) return PEOPLE.crowds[st.id];
  if (!PEOPLE.variants) {
    const save = R; R = mulberry(4242);
    PEOPLE.variants = []; for (let i = 0; i < PV; i++) PEOPLE.variants.push(personGeometry(i >= PV - 2, 'stand', true));
    R = save;
    PEOPLE.imat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
    PEOPLE.imat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
        vColor = color.xyz;
        #ifdef USE_INSTANCING_COLOR
          if (color.r > .98 && color.g < .02 && color.b > .98) vColor.xyz = instanceColor.xyz;
        #endif`);
    };
  }
  const meshes = PEOPLE.variants.map(g => {
    const m = new THREE.InstancedMesh(g, PEOPLE.imat, PCAP);
    m.frustumCulled = false; m.castShadow = false; m.userData.dyn = true;
    for (let i = 0; i < PCAP; i++) { m.setMatrixAt(i, _pZero); m.setColorAt(i, _pC.set('#ffffff')); }
    addToChunk(st.s, m); return m;
  });
  return (PEOPLE.crowds[st.id] = { meshes, free: meshes.map(() => [...Array(PCAP).keys()].reverse()), dirty: true });
}
function crowdReset() {
  for (const id in PEOPLE.crowds) {
    const c = PEOPLE.crowds[id];
    c.meshes.forEach((m, v) => { for (let i = 0; i < PCAP; i++) m.setMatrixAt(i, _pZero); c.free[v] = [...Array(PCAP).keys()].reverse(); m.instanceMatrix.needsUpdate = true; });
  }
}
function crowdTake(st, kid) {
  const c = crowdFor(st);
  // kids are the last 2 shapes; adults pick any free one of the first 6
  const order = kid ? [PV - 2, PV - 1] : [0, 1, 2, 3, 4, 5].sort(() => R() - .5);
  for (const v of order) if (c.free[v].length) {
    const slot = c.free[v].pop();
    c.meshes[v].setColorAt(slot, _pC.set(pick(SHIRT))); c.meshes[v].instanceColor.needsUpdate = true;
    return { c, v, slot };
  }
  return null;
}
function crowdFree(p) { if (!p.inst) return; const { c, v, slot } = p.inst; c.meshes[v].setMatrixAt(slot, _pZero); c.meshes[v].instanceMatrix.needsUpdate = true; c.free[v].push(slot); p.inst = null; }
// person record: {inst, s, lat, y, face, sway, hidden, path:[{s,lat}], speed, state, st, bob}
function placePerson(p) {
  if (!p.inst) return;
  const { c, v, slot } = p.inst, m = c.meshes[v];
  posAt(p.s, p.lat, p.y, _pO.position);
  // nobody stands right in front of the platform camera
  if (p.hidden || (CAM.view === 'platform' && _pO.position.distanceToSquared(W.camera.position) < 2.6 * 2.6)) m.setMatrixAt(slot, _pZero);
  else {
    _pO.position.y += Math.abs(Math.sin(p.bob)) * (p.path.length ? .05 : 0);
    _pO.rotation.set(0, yawAt(p.s) + p.face + (p.sway || 0), 0); _pO.updateMatrix();
    m.setMatrixAt(slot, _pO.matrix);
  }
  m.instanceMatrix.needsUpdate = true;
}
function populateStations() {
  crowdReset();
  PEOPLE.list = [];
  R = mulberry(77);
  for (const st of STATIONS) {
    st.waiting = [];
    // queues at the doors of a train that stops on the "3" marker
    for (let i = 0; i < 3; i++) for (const dx of C205.doors) {
      const ds = st.stopS - 10 - i * 20.5 + dx;
      const n = R() < .25 ? 0 : 1 + Math.floor(R() * (st.big ? 3 : 2));
      for (let q = 0; q < n; q++) {
        const p = newPerson(st, ds + (q % 2 ? .5 : -.5), PLAT.E + 1.25 + q * .55, 0);
        if (p) st.waiting.push(p);
      }
    }
    // a few people elsewhere on both platforms
    for (let i = 0; i < (st.big ? 14 : 7); i++) {
      const side = R() < .5 ? 1 : -1;
      newPerson(st, st.s + rr(-70, 70), side * (PLAT.E + rr(1.5, 3.8)), (side > 0 ? 0 : Math.PI) + rr(-.9, .9));
    }
  }
}
function newPerson(st, s, lat, face, extra = {}) {
  const inst = crowdTake(st, R() < .15); if (!inst) return null;
  const p = Object.assign({ inst, s, lat, y: PLAT.Y, face, sway: 0, hidden: false, path: [], speed: rr(1.1, 1.5), bob: R() * 6, st, state: 'idle' }, extra);
  placePerson(p); PEOPLE.list.push(p);
  return p;
}
function walkTo(p, pts) { p.path = pts.map(([s, lat]) => ({ s, lat })); }
/* doors are open at station st: some people get off, then the queue gets on */
function startPassengerFlow(st, train) {
  let doors = C205.doors.flatMap(dx => [0, 1, 2].map(i => train.s - 10 - i * 20.5 + dx)).filter(d => Math.abs(d - st.s) < TRACK.PLAT_HALF - 2);
  if (!doors.length) return;
  const inLat = TRACK.PLAYER + .4, edge = PLAT.E + .2;
  const nOff = st.idx === 0 ? 0 : st.idx === STATIONS.length - 1 ? 16 : 3 + Math.floor(Math.random() * 6);
  const exitS = st.s - 34;
  for (let i = 0; i < nOff; i++) {
    const d = pick(doors);
    const p = newPerson(st, d, inLat, 0, { y: PLAT.Y + .05, speed: rr(1.2, 1.6), bob: 0, state: 'off', delay: i * .45 + Math.random() * .4, hidden: true });
    if (!p) break; placePerson(p);
    walkTo(p, [[d, edge + .4], [d + rr(-1, 1), PLAT.E + rr(2.2, 3.4)], [exitS + rr(-2, 2), PLAT.E + PLAT.D - 1.3], [exitS - 8, PLAT.E + PLAT.D - 1.3]]);
  }
  if (st.idx === STATIONS.length - 1) return;   // nobody boards at the terminus
  st.waiting.forEach((p, i) => {
    const d = doors.reduce((a, b) => Math.abs(b - p.s) < Math.abs(a - p.s) ? b : a);
    p.state = 'on'; p.delay = 1.6 + i * .25 + Math.random() * .5;
    walkTo(p, [[d + (p.s > d ? .4 : -.4), PLAT.E + 1.0], [d, edge], [d, inLat]]);
  });
  st.waiting = [];
}
function updatePeople(dt, camPos) {
  // whole station crowds are only drawn when the camera is near that station
  for (const st of STATIONS) { const c = PEOPLE.crowds[st.id]; if (!c) continue; const on = posAt(st.s, 0, 0, _pO.position).distanceToSquared(camPos) < 420 * 420; c.meshes.forEach(m => { m.visible = on; }); }
  for (const p of PEOPLE.list) {
    if (!p.inst || !p.inst.c.meshes[0].parent.visible || !p.inst.c.meshes[0].visible) continue;
    if (p.delay > 0) { p.delay -= dt; continue; }
    if (p.state === 'off' && p.hidden) p.hidden = false;
    if (p.path.length) {
      const t = p.path[0], ds = t.s - p.s, dl = t.lat - p.lat, d = Math.hypot(ds, dl);
      const step = p.speed * dt;
      if (d <= step) { p.s = t.s; p.lat = t.lat; p.path.shift(); }
      else { p.s += ds / d * step; p.lat += dl / d * step; p.face = Math.atan2(ds, -dl); }
      p.bob += dt * 9;
      if (!p.path.length) {
        if (p.state === 'on' || p.state === 'off') { p.state = 'gone'; crowdFree(p); continue; }
        else p.face = 0;
      }
      placePerson(p);
    } else if (p.state === 'idle') {
      // gentle sway, a few times a second is plenty
      p.bob += dt; p.sway = Math.sin(p.bob * .7) * .08;
      if ((p.swayT = (p.swayT || 0) + dt) > .12) { p.swayT = 0; placePerson(p); }
    }
  }
  PEOPLE.list = PEOPLE.list.filter(p => p.state !== 'gone');
  // re-check who is too close to the camera when the view changes or the camera moves on the platform
  if (CAM.view !== PEOPLE.lastView || (CAM.view === 'platform' && (PEOPLE.camT = (PEOPLE.camT || 0) + dt) > .3)) {
    PEOPLE.lastView = CAM.view; PEOPLE.camT = 0;
    for (const p of PEOPLE.list) if (p.inst && p.inst.c.meshes[0].visible) placePerson(p);
  }
}
// doors closing: anyone still on the platform stays (they missed the train!)
function freezeBoarders() {
  for (const p of PEOPLE.list) if (p.state === 'on' && p.path.length && p.lat > PLAT.E - .1 && p.delay <= 0) { p.path = []; p.state = 'idle'; p.face = 0; placePerson(p); }
  for (const p of PEOPLE.list) if (p.state === 'on' && p.delay > 0) { p.state = 'idle'; p.path = []; }
}
