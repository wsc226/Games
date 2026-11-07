/* ═══ MAIN ═══ */
let built = false, train = null, lastT = 0, chunkT = 0, wiperPrev = { f: 0, b: 0 };
function buildAll() {
  if (built) return; built = true;
  buildRoute(); planShk(); trackMaterials(); worldMaterials(); structMaterials(); linesideMaterials(); stationMaterials(); shkMaterials();
  initWorld(); buildGround(); buildRivers(); buildTunnels(); buildChunks();
  buildStations(); buildSwitches(); buildSignals(); buildCrossings(); buildSigns(); buildPylons(); buildBackdrop();
  train = new Train205(W.scene); DRV.train = train;
  buildAmbient(); buildRacer(); buildMinimap(); buildShkStations(); buildZoomer(); planCaution();
  // fuse the static world into a few big meshes per chunk (iPad draw calls)
  chunks.forEach(c => mergeDeep(c.group)); EXTRAS.forEach(e => mergeDeep(e.group));
  setupCameraInput(); setupButtons();
  applyQuality(false);
}
function startGame(mode) {
  initA();
  G.mode = mode;
  $('loading').classList.add('show');
  // let the loading screen paint before the heavy build
  setTimeout(() => {
    buildAll();
    resetRun();
    if (mode === 'race') startRace(); else stopRace();
    $('scr-title').classList.add('gone'); $('scr-game').classList.remove('gone'); $('loading').classList.remove('show');
    onResize();
    G.running = true; lastT = performance.now(); requestAnimationFrame(loop);
    startTrainSound(); keepAwake(true);
    if (mode === 'regular') setTimeout(() => say('welcome', { cb: () => { if (DRV.atSt === 0 && DRV.doors === 'closed') { $('b-door').classList.add('hint'); bigMsg('Open the doors! 🚪<small>Let the passengers on</small>', 2400); } } }), 800);
  }, 60);
}
function resetRun() {
  train.s = STATIONS[0].stopS; train.v = 0; DRV.state = 'stopped'; DRV.nextIdx = 1; DRV.fast = true;
  Object.assign(DRV, { atSt: 0, doors: 'closed', doorK: 0, announced: {}, leftFrom: -1 }); train.setDoors(0);
  populateStations(); resetCallouts();
  setGoButton(); refreshNext(); setView('outside');
  $('b-lt').classList.toggle('on', train.lights.on); $('b-lc').className = 'cb ' + train.lights.color;
  $('b-fast').className = 'cb fast'; $('b-fast').innerHTML = '<i>🐇</i><b>Fast</b>'; $('b-lc-t').textContent = train.lights.color === 'red' ? 'Red' : 'White';
  train.place(); updateCamera(0, train);
}
function goHome() {
  setPaused(false);
  G.running = false; cancelVoice(); stopTrainSound(); hornOff(); stopRace(); keepAwake(false);
  $('scr-game').classList.add('gone'); $('scr-title').classList.remove('gone');
}
function tick(dt) {
  G.t += dt;
  updateDrive(dt);
  updateRace(dt);
  train.update(dt);
  for (const [k, key] of [['f', 'tf'], ['b', 'tb']]) {
    const ph = Math.floor(train.wiper[key] / Math.PI); if (ph !== wiperPrev[k]) { wiperPrev[k] = ph; if (train.wiper[key] > 0) sfx('wiper'); }
  }
  const cp = W.camera.position;
  updateAmbient(dt, train, cp);
  updatePeople(dt, cp);
  updateZoomer(dt, train, cp);
  updateCallouts(dt, train);
  updateSwitches(dt, train.s, cp);
  updateSignals(train.s, W.camera.position);
  updateCrossings(dt, AMB.active ? [{ s: train.s, dir: 1 }, { s: AMB.train.s, dir: -1 }] : [{ s: train.s, dir: 1 }], cp);
  updateCamera(dt, train); train.lod(W.camera.position, CAM.view);
  updateCabInstruments(dt, train);
  updateTunnelLight(dt, train);
  followSun(train.cars[1].position);
  W.backdrop.position.set(cp.x, 120, cp.z);
  for (const r of FEAT.rivers) if (r.waterMat) r.waterMat.map.offset.x += dt * .004;
  chunkT -= dt; if (chunkT <= 0) { chunkT = .3; updateChunks(); }
}
/* ── auto quality: watch the frame rate and step resolution / shadow detail ──
   tier 0 = lightest … 3 = sharpest. Remembered per device. */
const QUAL = { tiers: [
    { pr: 1.0, shadow: 1024, far: 1300, fog: 1150 },
    { pr: 1.25, shadow: 1024, far: 1550, fog: 1350 },
    { pr: 1.5, shadow: 2048, far: 1750, fog: 1500 },
    { pr: 1.75, shadow: 2048, far: 1750, fog: 1500 }],
  tier: 2, max: 3, acc: 0, n: 0, slow: 0, good: 0, hold: 0, tryUp: false };
try { const q = +localStorage.getItem('t205Q'); if (q >= 0 && q <= 3 && localStorage.getItem('t205Q') !== null) QUAL.tier = q; } catch (e) {}
function applyQuality(save = true) {
  const t = QUAL.tiers[QUAL.tier], r = W.renderer;
  r.setPixelRatio(Math.min(devicePixelRatio || 1, t.pr)); onResize();
  if (W.sun.shadow.mapSize.x !== t.shadow) { W.sun.shadow.mapSize.set(t.shadow, t.shadow); if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; } }
  W.scene.fog.far = t.fog; CHUNK_FAR = t.far;
  if (save) try { localStorage.setItem('t205Q', String(QUAL.tier)); } catch (e) {}
}
function watchQuality(rawDt) {
  if (document.hidden || rawDt > .25) return;          // ignore tab switches + hiccups
  QUAL.acc += rawDt; QUAL.n++;
  if (QUAL.acc < 2) return;
  const fps = QUAL.n / QUAL.acc; QUAL.acc = 0; QUAL.n = 0;
  if (QUAL.hold > 0) { QUAL.hold--; return; }          // let a change settle first
  if (fps < 44) QUAL.slow++; else QUAL.slow = 0;
  if (fps > 57) QUAL.good++; else QUAL.good = 0;
  if (QUAL.good >= 3) QUAL.tryUp = false;            // the last step up has proven itself
  // a step up that turned out too slow is not tried again this session
  if (QUAL.slow >= 2 && QUAL.tier > 0) { QUAL.tier--; if (QUAL.tryUp) QUAL.max = QUAL.tier; QUAL.tryUp = false; QUAL.slow = 0; QUAL.good = 0; QUAL.hold = 1; applyQuality(); }
  else if (QUAL.good >= 8 && QUAL.tier < QUAL.max) { QUAL.tier++; QUAL.good = 0; QUAL.hold = 1; QUAL.tryUp = true; applyQuality(); }
}
function loop(now) {
  if (!G.running) return;
  const raw = (now - lastT) / 1000;
  const dt = Math.min(.05, raw); lastT = now;
  if (G.paused) { W.renderer.render(W.scene, W.camera); requestAnimationFrame(loop); return; }
  watchQuality(raw);
  tick(dt);
  updateTrainSound(dt, train.v, DRV.state === 'go' && train.v < targetSpeed() - .3, DRV.state === 'braking', LOOK_VIEWS.includes(CAM.view), trainSoundEnv(train));
  drawSpeedo(train.v);
  if ((G.frame = (G.frame || 0) + 1) % 3 === 0) drawMinimap();
  W.renderer.render(W.scene, W.camera);
  requestAnimationFrame(loop);
}
tap($('m-reg'), () => startGame('regular'));
tap($('m-race'), () => startGame('race'));
tap($('res-again'), () => { resetRun(); startRace(); });
tap($('res-home'), goHome);
/* ── pause: freeze the world, hush every sound, big ▶ to carry on ── */
function setPaused(p) {
  if (!!G.paused === p) return;
  G.paused = p; $('paused').classList.toggle('show', p);
  if (p) { cancelVoice(); hornOff(); if (A) A.suspend().catch(() => {}); }
  else { if (A) A.resume().catch(() => {}); lastT = performance.now(); }
}
tap($('pause'), () => setPaused(true));
tap($('resume'), () => setPaused(false));
setMuted(muted);
/* ── iPad niceties ── */
// no pinch / double-tap zoom, no long-press menus, no rubber-band scrolling
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || !e.target.closest('#gl')) e.preventDefault(); }, { passive: false });
// keep the screen awake while driving
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
// back from the Home Screen / sleep: wake the sound up and re-take the wake lock
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (A && A.state !== 'running' && !G.paused) A.resume().catch(() => {});
  if (G.running) { keepAwake(true); lastT = performance.now(); }
});
// grown-up tip when it is opened in Safari instead of from the Home Screen
const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
if (!standalone && /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) $('t-install').classList.remove('gone');
// debug hook for testing in the browser
window.__t205 = { G, DRV, TRACK, STATIONS, CAM, W: () => W, train: () => train, setView, startGame,
  FEAT, AMB, SWITCHES, SIGNALS, CROSSINGS, THREE, EXTRAS, PEOPLE, pressDoors, RC, RACE, startRace, SHK, ZOOM, shkOff, CO,
  step(sec) { for (let i = 0; i < sec * 30; i++) tick(1 / 30); updateChunks(); drawSpeedo(train.v + Math.random() * .01); W.renderer.render(W.scene, W.camera); } };
