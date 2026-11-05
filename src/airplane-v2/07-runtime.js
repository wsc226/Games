/* ═══ RUNTIME: render loop, cameras, views, timers ═══ */
const RT = { plane: null, view: 'chase', running: false, tick: null, t: 0, lastUser: -99, preset: { az: -40, el: 12, dist: 95 },
  look: { yaw: 0, pitch: 0 }, shake: 0, instrHz: 0, instrT: 0, anchor: new THREE.Vector3(), prevAnchor: new THREE.Vector3(), autoOrbit: 0 };
const VIEWS = {
  cockpit: { eye: () => EYE_COCKPIT, yaw: -Math.PI / 2, pitch: -11 * DEG, fov: 72 },
  pilot: { eye: () => EYE_PILOT, yaw: -Math.PI / 2, pitch: -2 * DEG, fov: 60 },
  cabin: { eye: () => EYE_CABIN, yaw: -Math.PI / 2, pitch: -3 * DEG, fov: 70 },
  window: { eye: () => EYE_WINDOW, yaw: Math.atan2(-.45, -1), pitch: -9 * DEG, fov: 66 },
};
/* ── timers & tweens (cleared on reset) ── */
let timers = [], tweens = [];
function later(ms, fn) { const id = setTimeout(() => { timers = timers.filter(t => t !== id); fn(); }, ms); timers.push(id); return id; }
function tween(dur, fn, done) { const tw = { t: 0, dur, fn, done }; tweens.push(tw); return tw; }
function clearTimers() { timers.forEach(clearTimeout); timers = []; tweens = []; }
function runTweens(dt) { for (const tw of [...tweens]) { tw.t += dt; const k = clamp(tw.t / tw.dur, 0, 1); tw.fn(k); if (k >= 1) { tweens = tweens.filter(x => x !== tw); tw.done && tw.done(); } } }

function setupControls() {
  const c = new OrbitControls(W.camera, W.renderer.domElement);
  c.enableDamping = true; c.dampingFactor = .08; c.enablePan = false; c.minDistance = 25; c.maxDistance = 400; c.maxPolarAngle = Math.PI * .495;
  c.addEventListener('start', () => { RT.lastUser = RT.t; });
  RT.controls = c;
  // drag-to-look inside the aircraft (takeoff mode)
  let drag = null; const el = W.renderer.domElement;
  el.addEventListener('pointerdown', e => { if (RT.view !== 'chase' && GAME === 'takeoff') drag = { x: e.clientX, y: e.clientY, yaw: RT.look.yaw, pitch: RT.look.pitch }; });
  addEventListener('pointermove', e => { if (!drag) return; RT.look.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .004, -1.6, 1.6); RT.look.pitch = clamp(drag.pitch + (e.clientY - drag.y) * .004, -.9, .7); });
  addEventListener('pointerup', () => { drag = null; });
}
function setView(v) {
  RT.view = v; const P = RT.plane;
  $$('.vb').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (P.cockpit) P.cockpit.visible = v === 'cockpit';
  if (P.cabin) P.cabin.visible = v === 'cabin';
  $('winframe').classList.toggle('show', v === 'window');
  RT.controls.enabled = v === 'chase';
  RT.look.yaw = 0; RT.look.pitch = 0;
  RT.baseFov = v === 'chase' ? 50 : VIEWS[v].fov; applyFov(); W.camera.near = v === 'chase' ? .5 : .03; W.camera.updateProjectionMatrix();
  if (v === 'chase') { placeChase(true); }
  ambienceForView();
}
function ambienceForView() {
  const f = SFX_FILES.cabin_ambience; if (!f || !f.ok) return;
  const inside = RT.view !== 'chase' && RT.plane && RT.plane.state.n1 > .05 && !muted;
  if (inside) { f.el.loop = true; f.el.volume = .5; if (f.el.paused) f.el.play().catch(() => {}); } else if (!f.el.paused) f.el.pause();
}
function chasePos(out) {
  const P = RT.plane, pr = RT.preset, a = pr.az * DEG, e = pr.el * DEG, h = P.root.rotation.y;
  const lx = Math.cos(a) * Math.cos(e) * pr.dist, lz = Math.sin(a) * Math.cos(e) * pr.dist, ly = Math.sin(e) * pr.dist;
  // rotate local (x fwd, z right) by heading about Y
  out.set(lx * Math.cos(h) + lz * Math.sin(h), ly, -lx * Math.sin(h) + lz * Math.cos(h)).add(RT.anchor);
  out.y = Math.max(out.y, 2);
  return out;
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
function placeChase(snap) { anchorUpdate(); if (snap) { chasePos(W.camera.position); RT.controls.target.copy(RT.anchor); RT.controls.update(); } }
function anchorUpdate() { RT.plane.model.localToWorld(RT.anchor.set(-2, 0, 0)); }
function setPreset(p, snap = false) { RT.preset = { ...RT.preset, ...p }; RT.lastUser = -99; if (snap) placeChase(true); }
function updateCamera(dt) {
  const P = RT.plane, cam = W.camera;
  if (RT.view === 'chase') {
    RT.prevAnchor.copy(RT.anchor); anchorUpdate();
    cam.position.add(_v.copy(RT.anchor).sub(RT.prevAnchor));
    RT.controls.target.copy(RT.anchor);
    if (RT.autoOrbit) RT.preset.az += RT.autoOrbit * dt;
    if (RT.t - RT.lastUser > 5) cam.position.lerp(chasePos(_v), 1 - Math.exp(-1.1 * dt));
    RT.controls.update();
  } else {
    const V = VIEWS[RT.view];
    P.model.localToWorld(cam.position.copy(V.eye()));
    P.model.getWorldQuaternion(_q);
    _e.set(V.pitch + RT.look.pitch + (RT.pitchBias || 0), V.yaw - RT.look.yaw, 0, 'YXZ');
    cam.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromEuler(_e));
  }
  if (RT.shake > 0) { const s = RT.shake * (RT.view === 'chase' ? .25 : .02); cam.position.x += rnd(-s, s); cam.position.y += rnd(-s, s); cam.position.z += rnd(-s, s); }
}
// Views are framed for landscape. On a tall screen, widen the vertical FOV so the
// horizontal field of view stays what it would be at a 4:3 aspect (no tunnel vision).
function applyFov() {
  const base = RT.baseFov || W.camera.fov, a = W.camera.aspect, A = 4 / 3;
  W.camera.fov = a >= A ? base : Math.min(100, 2 * Math.atan(Math.tan(base * DEG / 2) * A / a) / DEG);
  W.camera.updateProjectionMatrix();
}
function resize() {
  if (!W.renderer) return; const el = $('scene'); const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
  W.renderer.setSize(w, h, false); W.camera.aspect = w / h; applyFov();
}
let lastNow = 0;
function frame(now) {
  if (!RT.running) return; requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - (lastNow || now)) / 1000); lastNow = now;
  advance(dt);
}
function advance(dt) {
  RT.t += dt;
  runTweens(dt);
  RT.tick && RT.tick(dt, RT.t);
  RT.plane.update(dt, RT.t);
  (RT.others || []).forEach(o => o.update(dt, RT.t));
  updateCamera(dt);
  aimSun(RT.plane.root.position);
  W.sky.position.copy(W.camera.position); W.stars.position.copy(W.camera.position);
  engineTick(dt);
  W.renderer.render(W.scene, W.camera);
}
function startLoop() { if (RT.running) return; RT.running = true; lastNow = 0; requestAnimationFrame(frame); }
function stopLoop() { RT.running = false; stopEngineNodes(); }
