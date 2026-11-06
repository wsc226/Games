/* ═══ CAMERAS ═══
   'outside' : chase camera around the train (drag to swing around, pinch to zoom)
   'cab'     : the driver's seat           'inside'  : sitting in car 2 with the passengers
   'platform': standing on the platform    'top'     : looking straight down
   'bottom'  : between the rails, looking up at the wheels                       */
const VIEWS = [
  { id: 'outside', icon: '🎥', en: 'Outside' },
  { id: 'cab', icon: '🕹️', en: 'Driver' },
  { id: 'inside', icon: '💺', en: 'Inside' },
  { id: 'platform', icon: '🚉', en: 'Platform' },
  { id: 'top', icon: '🛰️', en: 'Top' },
  { id: 'bottom', icon: '⚙️', en: 'Bottom' },
];
const LOOK_VIEWS = ['cab', 'inside', 'bottom'];
const _cv = new THREE.Vector3(), _ce = new THREE.Vector3(), _cl = new THREE.Vector3();
const CAM = { view: 'outside', az: -28, el: 11, dist: 34, drag: null, pinch: null, lastUser: -99,
  anchor: new THREE.Vector3(), look: new THREE.Vector3(), pos: new THREE.Vector3(), yaw: 0, pitch: 0 };
function setupCameraInput() {
  const el = W.renderer.domElement;
  const pts = new Map();
  el.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture(e.pointerId);
    if (pts.size === 1) CAM.drag = { x: e.clientX, y: e.clientY, az: CAM.az, el: CAM.el, yaw: CAM.yaw, pitch: CAM.pitch };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; CAM.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: CAM.dist }; CAM.drag = null; }
    CAM.lastUser = G.t; });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (CAM.pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); CAM.dist = clamp(CAM.pinch.dist * CAM.pinch.d / d, 14, 140); }
    else if (CAM.drag && LOOK_VIEWS.includes(CAM.view)) {
      CAM.yaw = clamp(CAM.drag.yaw + (e.clientX - CAM.drag.x) * .005, -2.6, 2.6); CAM.pitch = clamp(CAM.drag.pitch + (e.clientY - CAM.drag.y) * .004, -.9, .9);
    }
    else if (CAM.drag) { CAM.az = CAM.drag.az - (e.clientX - CAM.drag.x) * .35; CAM.el = clamp(CAM.drag.el + (e.clientY - CAM.drag.y) * .2, -2, 70); }
    CAM.lastUser = G.t; });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) CAM.pinch = null; if (!pts.size) CAM.drag = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { CAM.dist = clamp(CAM.dist * (1 + e.deltaY * .001), 14, 140); }, { passive: true });
}
function setView(id) {
  CAM.view = id; const v = VIEWS.find(x => x.id === id);
  $('cam-i').textContent = v.icon; $('cam-l').innerHTML = `Camera<br>${v.en}`;
  CAM.snap = true; CAM.yaw = 0; CAM.pitch = 0;
  W.camera.near = LOOK_VIEWS.includes(id) ? .03 : .6; W.camera.updateProjectionMatrix();
}
function nextView() { const i = VIEWS.findIndex(v => v.id === CAM.view); setView(VIEWS[(i + 1) % VIEWS.length].id); }
function updateCamera(dt, train) {
  const cam = W.camera, lead = train.cars[0], mid = train.cars[1];
  const heading = lead.rotation.y;
  // inside a tunnel the outside/top cameras would be inside the hill: ride just ahead of the train
  if ((CAM.view === 'outside' || CAM.view === 'top') && tunnelAt(train.s)) {
    posAt(train.s + 15, train.off - 1.0, 2.9, cam.position); posAt(train.s - 8, train.off, 1.9, CAM.anchor);
    cam.lookAt(CAM.anchor); cam.fov = 60; cam.updateProjectionMatrix(); CAM.snap = true; return;
  }
  if (CAM.view === 'outside') {
    CAM.anchor.set(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(2).add(lead.position); CAM.anchor.y += 2.2;
    const a = (CAM.az) * DEG + heading, e = CAM.el * DEG;
    const want = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), -Math.sin(a) * Math.cos(e)).multiplyScalar(CAM.dist).add(CAM.anchor);
    want.y = Math.max(want.y, GROUND + 1.2);
    { // keep the camera above hills
      const ds = (want.x - lead.position.x) * Math.cos(heading) - (want.z - lead.position.z) * Math.sin(heading);
      const sc = train.s - 10 + ds, f = posAt(sc, 0, 0, _cv), lat = -(want.x - f.x) * Math.cos(headingAt(sc)) - (want.z - f.z) * Math.sin(headingAt(sc));
      const h = terrainAt(sc, lat); if (h > 0) want.y = Math.max(want.y, GROUND + h + 3);
    }
    if (CAM.snap) { CAM.pos.copy(want); CAM.snap = false; } else CAM.pos.lerp(want, 1 - Math.exp(-6 * dt));
    cam.position.copy(CAM.pos); cam.lookAt(CAM.anchor);
    cam.fov = 50;
  } else if (CAM.view === 'platform') {
    // standing on platform 1 of the station we are at (or the next one), watching the train
    const st = DRV.atSt >= 0 ? STATIONS[DRV.atSt] : nextStation();
    posAt(st.stopS + 14, PLAT.E + 1.3, PLAT.Y + 1.75, cam.position);   // inside the column line, so no pillar blocks the view
    const near = train.s > st.s - 600 && train.s < st.s + 200;
    const tgt = near ? lead.position.clone().add(new THREE.Vector3(0, 2.7, 0)) : posAt(st.s - 260, train.off, 2.5);
    if (near && train.s > st.stopS + 4) tgt.copy(train.cars[2].position).setY(tgt.y);
    if (CAM.snap || CAM.lastSt !== st.idx) { CAM.look.copy(tgt); CAM.snap = false; CAM.lastSt = st.idx; } else CAM.look.lerp(tgt, 1 - Math.exp(-4 * dt));
    cam.lookAt(CAM.look); cam.fov = 58;
    if (G.mode === 'regular' && train.s > st.s - 650 && train.s < st.s - 180 && DRV.state === 'go' && !DRV.announced['plat' + st.idx]) {
      DRV.announced['plat' + st.idx] = 1; DRV.announced['app' + st.idx] = 1; say('platform_arriving');
    }
  } else if (CAM.view === 'cab' || CAM.view === 'inside') {
    // eye inside the car; drag to look around
    const car = CAM.view === 'cab' ? lead : mid;
    const eye = CAM.view === 'cab' ? _ce.set(8.3, 3.0, -.45) : _ce.set(-9.45, 2.55, 0);
    const p0 = CAM.view === 'cab' ? -.17 : -.1, y0 = CAM.view === 'cab' ? .04 : 0;
    const yw = y0 + CAM.yaw, pt = p0 - CAM.pitch;
    _cl.set(Math.cos(yw) * Math.cos(pt), Math.sin(pt), -Math.sin(yw) * Math.cos(pt)).add(eye);
    car.updateMatrixWorld(); car.localToWorld(eye); car.localToWorld(_cl);
    cam.position.copy(eye); cam.lookAt(_cl); cam.fov = CAM.view === 'cab' ? 64 : 70;
  } else if (CAM.view === 'bottom') {
    // between the rails under car 2, looking forward and up at the bogies and wheels
    const car = mid; car.updateMatrixWorld();
    const yw = CAM.yaw, pt = .12 - CAM.pitch;
    _cl.set(Math.cos(yw) * Math.cos(pt) + 3.4, Math.sin(pt) + .28, -Math.sin(yw) * Math.cos(pt));
    car.localToWorld(_ce.set(3.4, .28, 0)); car.localToWorld(_cl);
    cam.position.copy(_ce); cam.lookAt(_cl); cam.fov = 72;
  } else if (CAM.view === 'top') {
    mid.getWorldPosition(CAM.anchor);
    const h = 55 + CAM.dist * .6;
    const want = CAM.anchor.clone().add(new THREE.Vector3(0, h, 0));
    if (CAM.snap) { CAM.pos.copy(want); CAM.snap = false; } else CAM.pos.lerp(want, 1 - Math.exp(-8 * dt));
    cam.position.copy(CAM.pos);
    // keep the train pointing "up" on screen
    cam.up.set(Math.cos(heading), 0, -Math.sin(heading));
    cam.lookAt(CAM.anchor); cam.up.set(0, 1, 0);
    cam.fov = 50;
  }
  cam.updateProjectionMatrix();
}
