/* ═══ LANDING MODE: final approach → flare → rollout, tight timing, realistic crashes, MAYDAY ═══
   Runway runs along +x (threshold x≈-400, far end x=3600), centreline z=0, same as takeoff.
   Altitude is real feet (y = ft × 0.3048). Approach is flown by the autopilot; the player
   must press each crucial button inside its time window or the matching crash happens. */
const TD_X = 2000, RWY_END = 3600, RWY_START = -400;
const LD_STEPS = [
  { id: 'flaps20', btn: 'l-flaps', start: 1950, k: 'STEP 1 OF 4', t: 'Set FLAPS 20', ask: 'landing.first_officer.ask_flaps20', ok: 'landing.first_officer.flaps20', warn: 'landing.gpws.too_low_flaps', fail: 'stall' },
  { id: 'gear', btn: 'l-gear', start: 1550, k: 'STEP 2 OF 4', t: 'LANDING GEAR down', ask: 'landing.first_officer.ask_gear', ok: 'landing.first_officer.gear_down', warn: 'landing.gpws.too_low_gear', fail: 'gear' },
  { id: 'flaps30', btn: 'l-flaps', start: 1150, k: 'STEP 3 OF 4', t: 'Set FLAPS 30', ask: 'landing.first_officer.ask_flaps30', ok: 'landing.first_officer.flaps30', warn: 'landing.gpws.too_low_flaps', fail: 'stall' },
  { id: 'spd', btn: 'l-spd', start: 750, k: 'STEP 4 OF 4', t: 'ARM the SPEED BRAKE', ask: 'landing.first_officer.ask_speedbrake', ok: 'landing.first_officer.speedbrake', warn: 'landing.first_officer.warn_speedbrake', fail: 'spd' },
];
const LD_ROLL = [
  { id: 'rev', btn: 'l-rev', t: 'REVERSE thrust!', ask: 'landing.first_officer.ask_reverse', ok: 'landing.first_officer.reverse', warn: 'landing.first_officer.warn_reverse', win: [3, 5] },
  { id: 'brk', btn: 'l-brk', t: 'BRAKES!', ask: 'landing.first_officer.ask_brakes', ok: 'landing.first_officer.brakes', warn: 'landing.first_officer.warn_brakes', win: [5, 8] },
];
const L_KEYS = ['l-flaps', 'l-gear', 'l-spd', 'l-flare', 'l-rev', 'l-brk'];
const CRASH_WHY = {
  stall: 'The flaps were not set in time, so the wings could not hold the plane up at landing speed.',
  gear: 'The landing gear was not down, so the plane landed on its belly.',
  hard: 'The FLARE came too late (or not at all), so the plane hit the runway too hard.',
  overrun: 'The plane could not stop before the end of the runway. Press REVERSE and BRAKES right after touchdown.',
};
let LD = {};
const _lv = new THREE.Vector3(), CHAR = new THREE.Color('#5a5a5a');

/* ── setup / teardown ── */
function ldSetup() {
  document.body.classList.remove('sky'); document.body.classList.add('landing');
  tkTeardown(); buildAirport(AL); fxInit();
  LD.clouds = cloudField({ count: 45, yMin: 420, yMax: 760, radius: 7000, size: 600, mat: W.cloudMat });
  RT.tick = ldTick;
}
function ldTeardown() {
  fxClear();
  (LD.detached || []).forEach(d => W.scene.remove(d.g));
  if (LD.clouds) LD.clouds.dispose();
  document.body.classList.remove('landing');
  $('ld-ra').style.display = 'none'; $('end-ov').classList.remove('crash'); $('fl-10').textContent = '10';
  $('guard').className = ''; LD = {};
}
/* horizontal distance flown from 2000 ft to touchdown with a normal flare at 35 ft */
function ldSimDist() {
  let a = 2000, vs = 25, gs = 72, x = 0, fl = false; const dt = .05;
  while (a > 0) { if (!fl && a <= 35) fl = true; ldVs(); a -= vs * dt; gs = damp(gs, fl ? 68 : 72, .3, dt); x += gs * dt; }
  return x;
  function ldVs() { const base = a > 200 ? 25 : (level === 'easy' ? 12 : 15);
    vs = fl ? damp(vs, Math.min(vs, Math.max(2.5, a / 2.2)), 1.0, dt) : damp(vs, base, 1.5, dt); }
}
function ldReset() {
  const P = RT.plane, st = P.state;
  LD = { ...LD, ph: 'APP', alt: 2000, vs: 25, gs: 72, pitch: 2.5, roll: 0, flared: false, flareOn: false, gearDown: false, flaps: 0, spd: false,
    rev: false, revK: 0, brk: false, si: 0, stepOn: false, stepT: 0, warned: false, reds: 0, fails: {}, tdVs: 0, tdT: 0, ri: [false, false], rWarn: [false, false],
    mayday: 'idle', fire: false, fireK: 0, e3: 1, q: [], qBusy: false, cur: null, co: {}, crashT: 0, detached: [], fires: [], t: 0, gwT: 0, stopT: 0 };
  LD.x = TD_X - ldSimDist();
  Object.assign(st, { flaps: 0, gear: 1, door: 0, n1: .55, beacon: true, strobes: true, landing: true, taxiLight: false, glow: 0, spoil: 0, ail: 0, elev: 0, rud: 0 });
  P.root.position.set(LD.x, LD.alt * .3048, 0); P.root.rotation.set(0, 0, LD.pitch * DEG);
  // annunciators: gear up (dark), flaps up
  ['lp-g1', 'lp-g2', 'lp-g3'].forEach(id => $(id).className = 'lamp'); $('fl-up').className = 'fl-cell lit'; $('fl-10').className = 'fl-cell'; $('fl-10').textContent = '20';
  beltOn = true; $('lp-belt').className = 'lamp amb';
  $('kt-lflaps').textContent = 'UP'; $('kt-lgear').textContent = 'UP'; $('kt-lspd').textContent = 'DOWN'; $('kt-lrev').textContent = 'OFF'; $('kt-lbrk').textContent = 'OFF';
  L_KEYS.forEach(id => $(id).classList.remove('lit', 'lit-a'));
  ldLockAll(); mdUiReset();
  hud('hud-gate', false); hud('hud-cmp', false); hud('taxi-l', false); hud('hud-alt', true);
  $('ld-ra').style.display = 'none'; $('end-ov').classList.remove('crash', 'show');
  ldCard('FINAL APPROACH', 'Runway ' + AL.rwy + ' ahead', 0);
}
function ldStart() {
  ldSetup(); ldReset(); setView('chase');
  setPreset({ az: -150, el: 10, dist: 95 }, true); RT.autoOrbit = 0;
  const carry = MD_CARRY; MD_CARRY = null;
  if (carry) { ldApplyCarry(carry); later(700, () => { ldSay('landing.tower.cleared'); if (carry === 'fire') ldSay('landing.first_officer.fire_remind'); }); }
  else later(700, () => { ldSay('landing.tower.cleared'); ldSay('landing.captain.prepare'); });
}

/* ── voice queue: step asks / warnings interrupt, chatter waits its turn ── */
function ldQNext() {
  if (LD.qBusy || !LD.q || !LD.q.length) return;
  const it = LD.q.shift(); LD.cur = it; LD.qBusy = true;
  say(it, { cb: () => { LD.cur = null; LD.qBusy = false; ldQNext(); } });
}
function ldSay(id) { LD.q.push(id); ldQNext(); }
function ldUrgent(id) {
  if (LD.cur) LD.q.unshift(LD.cur); LD.cur = null; LD.qBusy = true;
  say(id, { cb: () => { LD.qBusy = false; ldQNext(); } });
}

/* ── panel helpers ── */
function ldLockAll() { L_KEYS.forEach(id => { const b = $(id); b.classList.add('lkd'); b.classList.remove('guide', 'late'); }); }
function ldUnlock(id) { const b = $(id); b.classList.remove('lkd'); if (level === 'easy') b.classList.add('guide'); }
function ldLock(id) { const b = $(id); b.classList.add('lkd'); b.classList.remove('guide', 'late'); }
function ldCard(k, t, bar, warn = false) {
  $('ld-k').textContent = k; $('ld-t').textContent = t; $('ld-bar').style.width = clamp(bar, 0, 1) * 100 + '%';
  $('ld-card').classList.toggle('warn', warn);
}
const ldWin = () => level === 'easy' ? 12 : 8, ldGrace = () => level === 'easy' ? 6 : 4;

/* ── per-frame ── */
function ldTick(dt) {
  const P = RT.plane, st = P.state; LD.t += dt;
  if (LD.ph === 'APP') ldApproach(dt);
  else if (LD.ph === 'STALL') ldStall(dt);
  else if (LD.ph === 'ROLL') ldRollout(dt);
  else if (LD.ph === 'CRASH') ldCrashTick(dt);
  else if (LD.ph === 'STOP') { LD.stopT += dt; st.n1 = damp(st.n1, .25, 1, dt); }
  if (LD.ph !== 'CRASH') {
    P.root.position.set(LD.x, Math.max(0, LD.alt) * .3048, 0);
    P.root.rotation.set(LD.roll * DEG, 0, LD.pitch * DEG);
  }
  st.flaps = damp(st.flaps, LD.flaps === 30 ? 19 : LD.flaps === 20 ? 15 : 0, 1.2, dt);
  // engine 3 fire (MAYDAY)
  LD.fireK = damp(LD.fireK, LD.fire ? 1 : 0, LD.fire ? 1.5 : 1.2, dt); if (LD.engFire) LD.engFire.forEach(e => e.k = LD.fireK);
  if (LD.mayday !== 'idle') LD.e3 = damp(LD.e3, 0, .7, dt);
  fxTick(dt);
  if (LD.clouds) { LD.clouds.recycle(P.root.position, new THREE.Vector3(1, 0, 0)); LD.clouds.group.visible = P.root.position.y > 150; }
  setEnv(0, P.root.position.y); if (W.airport) W.airport.visible = true;
  // HUD + instruments
  $('hud-alt').textContent = String(Math.max(0, Math.round(LD.alt))).padStart(5, '0') + ' FT';
  const ra = $('ld-ra'); if (LD.ph === 'APP' && LD.alt < 200) { ra.style.display = 'block'; ra.textContent = Math.max(0, Math.round(LD.alt)); } else ra.style.display = 'none';
  RT.instrT -= dt; if (RT.instrT <= 0) { RT.instrT = .08; panelInstr(ldInstr(), ldEng()); }
  const cabinOn = RT.view === 'cabin';
  P.cabinLight.intensity = P.cabinLight2.intensity = cabinOn ? 12 : 0; P.cockpitLight.intensity = RT.view === 'cockpit' ? 6 : 0;
  engineSet(LD.ph === 'CRASH' ? 0 : st.n1);
}

function ldApproach(dt) {
  const P = RT.plane, st = P.state;
  const base = LD.alt > 200 ? 25 : (level === 'easy' ? 12 : 15);
  LD.vs = LD.flared ? damp(LD.vs, Math.min(LD.vs, Math.max(2.5, LD.alt / 2.2)), 1.0, dt) : damp(LD.vs, base, 1.5, dt);
  LD.alt -= LD.vs * dt; LD.gs = damp(LD.gs, LD.flared ? 68 : 72, .3, dt); LD.x += LD.gs * dt;
  LD.pitch = damp(LD.pitch, LD.flared ? 6 : 2.5, 1.2, dt);
  st.n1 = damp(st.n1, LD.flared ? .3 : .55, 1, dt);
  // altitude callouts
  const co = (a, id, urgent) => { if (LD.alt <= a && !LD.co[a]) { LD.co[a] = 1; urgent ? ldUrgent(id) : ldSay(id); } };
  co(1000, 'landing.gpws.1000'); co(500, 'landing.gpws.500'); co(200, 'landing.gpws.minimums');
  [50, 40, 30, 20, 10].forEach(a => co(a, 'landing.gpws.' + a, true));
  if (LD.alt <= 200 && !LD.co.cam200) { LD.co.cam200 = 1; setPreset({ az: -140, el: 4, dist: 78 }); }
  // gear still up after the gear step failed: keep warning
  if (LD.fails.gear) { LD.gwT -= dt; if (LD.gwT <= 0 && LD.alt > 60) { LD.gwT = 6; ldUrgent('landing.gpws.too_low_gear'); sfx('gear_horn'); } }
  // approach steps
  const s = LD_STEPS[LD.si];
  if (s) {
    if (!LD.stepOn) {
      if (LD.alt <= s.start) { LD.stepOn = true; LD.stepT = 0; LD.warned = false; ldUnlock(s.btn); ldUrgent(s.ask); sfx('call_bell'); }
      else ldCard(LD.mayday !== 'idle' ? 'EMERGENCY RETURN' : 'FINAL APPROACH', 'Next: ' + s.t.replace(/^Set |^ARM the /, ''), 1 - (LD.alt - s.start) / 400);
    }
    if (LD.stepOn) {
      LD.stepT += dt; const W1 = ldWin(), G = ldGrace();
      if (!LD.warned) ldCard(s.k, s.t, 1 - LD.stepT / W1);
      else ldCard(s.k + ' · HURRY!', s.t, 1 - (LD.stepT - W1) / G, true);
      if (LD.stepT > W1 && !LD.warned) { LD.warned = true; LD.reds++; const b = $(s.btn); b.classList.remove('guide'); b.classList.add('late'); sfx('master_caution'); ldUrgent(s.warn); }
      if (LD.stepT > W1 + G) ldStepFail(s);
    }
  } else if (!LD.flareOn && !LD.flared) ldCard(LD.mayday !== 'idle' ? 'EMERGENCY RETURN' : 'FINAL APPROACH', 'Get ready to FLARE', 1 - (LD.alt - 60) / 700);
  // flare window
  const top = level === 'easy' ? 100 : 60;
  if (!LD.flareOn && !LD.flared && LD.alt <= top && !LD_STEPS[LD.si]) { LD.flareOn = true; ldUnlock('l-flare'); }
  if (LD.flareOn && !LD.flared) {
    ldCard('RADIO ALTITUDE ' + Math.max(0, Math.round(LD.alt)) + ' FT', 'Press FLARE at "Thirty"!', LD.alt / top, LD.alt < 15);
    if (LD.alt < 15) { $('l-flare').classList.remove('guide'); $('l-flare').classList.add('late'); }
  }
  if (LD.alt <= 0) ldTouchdown();
}
function ldStepFail(s) {
  ldLock(s.btn); LD.stepOn = false; LD.si++;
  if (s.fail === 'stall') {
    LD.ph = 'STALL'; LD.stallT = 0; ldLockAll(); ldUrgent('landing.gpws.sink_rate'); sfx('master_caution');
    ldCard('STALL!', 'No flaps — the wings lost lift', 0, true); setPreset({ az: -40, el: 6, dist: 120 });
  } else if (s.fail === 'gear') { LD.fails.gear = true; LD.gwT = 5; ldCard('WARNING', 'GEAR IS STILL UP!', 0, true); }
  else if (s.fail === 'spd') { LD.fails.spd = true; ldCard('WARNING', 'No speed brake — stopping will be harder', 0, true); }
}
function ldStall(dt) {
  LD.stallT += dt; const k = LD.stallT;
  LD.pitch = k < 1.6 ? damp(LD.pitch, 13, 2, dt) : damp(LD.pitch, -16, .9, dt);
  LD.roll = k < 1.2 ? 0 : damp(LD.roll, 32, .8, dt);
  LD.vs = k < 1.6 ? damp(LD.vs, 5, 1, dt) : damp(LD.vs, 140, .5, dt);
  LD.alt -= LD.vs * dt; LD.x += LD.gs * dt; LD.gs = damp(LD.gs, 62, .3, dt);
  RT.shake = Math.max(RT.shake, k > 1.4 ? .5 : .25);
  if (k > 1.6 && !LD.co.pull) { LD.co.pull = 1; ldUrgent('landing.gpws.pull_up'); }
  if (LD.alt <= 0) { LD.alt = 0; ldCrash('stall'); }
}
function ldTouchdown() {
  const P = RT.plane, st = P.state;
  LD.alt = 0; LD.tdVs = Math.round(LD.vs * 60);
  ldLock('l-flare'); $('ld-ra').style.display = 'none';
  if (!LD.gearDown) return ldCrash('gear');
  if (LD.vs > (level === 'easy' ? 10.5 : 11)) return ldCrash('hard');
  LD.ph = 'ROLL'; LD.tdT = 0; sfx('touchdown'); RT.shake = clamp(LD.vs / 12, .25, .8);
  for (const z of [-5.5, 5.5]) fxEmit('steam', P.root.position.clone().add(new THREE.Vector3(-4, .5, z)), 6);
  if (LD.spd) { st.spoil = 1; ldUrgent('landing.first_officer.touchdown_spoilers'); } else ldUrgent('landing.first_officer.touchdown');
  ldUnlock('l-rev'); ldUnlock('l-brk');
  setPreset({ az: -165, el: 8, dist: 85 });
}
function ldRollout(dt) {
  const P = RT.plane, st = P.state; LD.tdT += dt;
  LD.pitch = damp(LD.pitch, 0, 1.6, dt);
  LD.revK = damp(LD.revK, LD.rev ? 1 : 0, 1.4, dt);
  const dec = .25 + (st.spoil > .5 ? .5 : 0) + (LD.rev ? .7 * LD.revK : 0) + (LD.brk ? 1.5 : 0);
  LD.gs = Math.max(0, LD.gs - dec * dt); LD.x += LD.gs * dt;
  st.n1 = damp(st.n1, LD.rev ? .72 : .27, 1.2, dt);
  if (LD.rev && LD.gs < 31) { LD.rev = false; $('kt-lrev').textContent = 'IDLE'; ldSay('landing.first_officer.sixty_knots'); }
  if (LD.gs < 20) st.spoil = damp(st.spoil, 0, .5, dt);
  // rollout steps (both live from touchdown; each has its own deadline)
  LD_ROLL.forEach((r, i) => {
    if (LD.ri[i]) return; const w = r.win[level === 'easy' ? 1 : 0];
    if (LD.tdT > .4 && !LD.co['ask' + i]) { LD.co['ask' + i] = 1; if (i === 0) ldUrgent(r.ask); else later(1200, () => { if (LD.ph === 'ROLL' && !LD.ri[1]) ldUrgent(r.ask); }); }
    if (LD.tdT > w && !LD.rWarn[i]) { LD.rWarn[i] = true; LD.reds++; $(r.btn).classList.remove('guide'); $(r.btn).classList.add('late'); sfx('master_caution'); ldUrgent(r.warn); }
  });
  const nx = LD_ROLL.find((r, i) => !LD.ri[i]);
  const left = Math.max(0, RWY_END - LD.x);
  if (nx) ldCard('ROLLOUT · ' + Math.round(left) + ' m of runway left', nx.t, left / 1600, LD.rWarn[LD_ROLL.indexOf(nx)]);
  else ldCard('ROLLOUT · ' + Math.round(left) + ' m of runway left', Math.round(LD.gs * 1.944) + ' KT', left / 1600);
  if (LD.x > RWY_END && LD.gs > 5) return ldCrash('overrun');
  if (LD.gs < .3) ldStopped();
}
function ldStopped() {
  const P = RT.plane, st = P.state;
  LD.ph = 'STOP'; LD.rev = false; ldLockAll(); if (LD.mayday !== 'fire') $('guard').classList.add('lkd'); st.spoil = 0;
  const soft = LD.tdVs < 360, stars = clamp(3 - LD.reds - (soft ? 0 : 1), 1, 3);
  ldCard('STOPPED', soft ? 'Smooth landing!' : 'Firm landing', 1);
  sfx('success_big'); setPreset({ az: -60, el: 12, dist: 110 }); RT.autoOrbit = 6;
  ldSay('landing.tower.welcome'); ldSay('landing.captain.welcome_home');
  if (LD.mayday !== 'idle') ldTrucksToPlane(false);
  later(LD.mayday !== 'idle' ? 7000 : 4500, () => {
    $('end-t').textContent = LD.mayday !== 'idle' ? 'EMERGENCY LANDED!' : soft ? 'BUTTER LANDING!' : 'WELL DONE';
    $('end-s').textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ·  touchdown ${LD.tdVs} ft/min${LD.reds ? ` · ${LD.reds} late button${LD.reds > 1 ? 's' : ''}` : ''}`;
    $('b-fly').textContent = 'FLY AGAIN ↻'; $('end-ov').classList.remove('crash'); $('end-ov').classList.add('show');
  });
}

/* ── crash ── */
function ldCrash(reason) {
  if (LD.ph === 'CRASH') return;
  const P = RT.plane, st = P.state;
  LD.ph = 'CRASH'; LD.reason = reason; LD.crashT = 0; P.wrecked = true; LD.fire = false;
  ldLockAll(); $('guard').classList.add('lkd'); $('ld-ra').style.display = 'none'; ldCard('CRASH!', 'Fire and rescue are on the way', 0, true);
  LD.q = []; LD.cur = null; LD.qBusy = false; cancelVoice();
  if (RT.view !== 'chase') setView('chase');
  const pos = P.root.position.clone();
  fxEmit('flash', pos.clone().add(new THREE.Vector3(0, 4, 0)), 1); fxEmit('fire', pos.clone().add(new THREE.Vector3(-6, 2, 0)), 30, null, 2.2);
  sfx('crash_boom'); RT.shake = 1.8; const fl = $('flash'); fl.className = ''; void fl.offsetWidth; fl.className = 'f-r';
  LD.slideV = reason === 'stall' ? 38 : Math.max(LD.gs, 18); LD.slidePitch = reason === 'stall' ? -6 : -2.5;
  LD.slideRoll = (reason === 'stall' ? 14 : rnd(6, 10)) * (Math.random() < .5 ? -1 : 1);
  st.gear = 1; st.n1 = 0; st.spoil = 0; st.strobes = false; st.landing = false;
  // engines that break away
  const off = { stall: [0, 1, 3], gear: [3], hard: [0, 3], overrun: [1] }[reason] || [0];
  off.forEach(i => { const g = P.engines[i]; if (!g) return; W.scene.attach(g); if (P.pylons[i]) P.pylons[i].visible = false;
    LD.detached.push({ g, v: new THREE.Vector3(LD.slideV * rnd(.5, .8), rnd(4, 8), (i < 2 ? -1 : 1) * rnd(5, 11)), w: new THREE.Vector3(rnd(-3, 3), rnd(-4, 4), rnd(-5, 5)) }); });
  // fire + smoke on the wreck and on each loose engine
  const local = (x, y, z) => out => P.model.localToWorld(out.set(x, y, z));
  const pts = [local(-4, -1, 6.5), local(-4, -1, -6.5), local(-12, .5, 0), local(4, -1, 0)];
  LD.detached.forEach(d => pts.push(out => d.g.getWorldPosition(out)));
  LD.fires = pts.map((p, i) => ({ f: fxEmitter('fire', p, 26, { k: 0, scale: i < 4 ? 1.4 : 1 }), s: fxEmitter('smoke', p, i < 3 ? 3 : 2, { k: 0, scale: 1.2 }), st: fxEmitter('steam', p, 4, { k: 0 }) }));
  LD.sparks = fxEmitter('spark', out => P.model.localToWorld(out.set(-8, -3.5, 0)), 90, { vel: () => new THREE.Vector3(-LD.slideV * .6, 2, 0) });
  LD.dirt = fxEmitter('dirt', out => P.model.localToWorld(out.set(4, -3.5, 0)), 0, {});
  if (LD.engFire) LD.engFire.forEach(e => e.on = false);
  setPreset({ az: 130, el: 12, dist: 115 }); RT.autoOrbit = 5;
  later(400, () => ldUrgent('landing.tower.crash'));
  later(2200, () => ldTrucksToPlane(true));
  later(7500, () => say('landing.rescue.all_safe'));
  later(9500, () => {
    $('end-t').textContent = 'CRASH!';
    $('end-s').textContent = CRASH_WHY[reason] + '\nEveryone got out safely, and the fire crew put the fire out.';
    $('b-fly').textContent = 'TRY AGAIN ↻'; $('end-ov').classList.add('crash', 'show');
  });
}
function ldCrashTick(dt) {
  const P = RT.plane; LD.crashT += dt; const k = LD.crashT;
  const onGrass = P.root.position.x < RWY_START || P.root.position.x > RWY_END;
  LD.slideV = Math.max(0, LD.slideV - (onGrass ? 9 : 6) * dt); LD.gs = LD.slideV;
  P.root.position.x += LD.slideV * dt;
  P.root.position.y = damp(P.root.position.y, -2.3, 6, dt);
  P.root.rotation.z = damp(P.root.rotation.z, LD.slidePitch * DEG, 3, dt);
  P.root.rotation.x = damp(P.root.rotation.x, LD.slideRoll * DEG, 2, dt);
  P.root.rotation.y = damp(P.root.rotation.y, LD.slideRoll * .6 * DEG, .8, dt);
  LD.sparks.k = !onGrass && LD.slideV > 3 ? 1 : 0; LD.dirt.rate = onGrass && LD.slideV > 2 ? 30 : 0;
  RT.shake = Math.max(RT.shake * Math.exp(-.8 * dt), LD.slideV > 3 ? .5 : 0);
  // loose engines tumble and come to rest
  LD.detached.forEach(d => { d.g.position.addScaledVector(d.v, dt); d.v.y -= 9.8 * dt;
    if (d.g.position.y < 1.5) { d.g.position.y = 1.5; d.v.y = Math.abs(d.v.y) * .25; d.v.x *= .9; d.v.z *= .9; d.w.multiplyScalar(.95); }
    d.g.rotation.x += d.w.x * dt; d.g.rotation.y += d.w.y * dt; d.g.rotation.z += d.w.z * dt; });
  // fire grows, then the trucks knock it down into steam
  const sprayed = LD.sprayT ? k - LD.sprayT : -1;
  const fk = sprayed < 0 ? clamp(k / 1.5, 0, 1) : clamp(1 - sprayed / 14, .12, 1);
  LD.fires.forEach(f => { f.f.k = fk; f.s.k = fk; f.st.k = sprayed < 0 ? 0 : clamp(sprayed / 3, 0, 1) * (1 - fk * .5); });
  P.fuseMat.color.lerp(CHAR, dt * .06);
}
/* fire trucks: drive from the fire station to the plane and spray */
function ldTrucksToPlane(crash) {
  const P = RT.plane, px = P.root.position.x;
  if (!FX.trucks.length) ldSpawnTrucks();
  const spots = crash ? [[px - 38, -34], [px + 6, -40], [px - 22, 38]] : [[px - 10, 38], [px + 14, 34], [px - 34, 42]];
  const tgt = crash ? [out => P.model.localToWorld(out.set(-4, 0, -6)), out => P.model.localToWorld(out.set(4, 0, 0)), out => P.model.localToWorld(out.set(-4, 0, 6))]
    : [0, 1, 2].map(() => out => (P.engines[2] ? P.engines[2].getWorldPosition(out) : P.model.localToWorld(out.set(0, 0, 11))));
  FX.trucks.forEach((T, i) => {
    const from = [T.root.position.x, T.root.position.z], [sx, sz] = spots[i];
    const mid = [sx - Math.sign(sx - from[0] || 1) * 60, sz < 0 ? -95 : 95];
    const d = Math.hypot(sx - from[0], sz - from[1]);
    truckDrive(T, [from, [lerp(from[0], mid[0], .5), lerp(from[1], mid[1], .7)], mid, [sx, sz]], clamp(d / 22, 3.5, 9), () => {
      truckSpray(T, tgt[i]); if (crash && !LD.sprayT) LD.sprayT = LD.crashT; });
  });
  if (!crash) later(3500, () => say('landing.rescue.mayday_safe'));
}
function ldSpawnTrucks() {
  for (let i = 0; i < 3; i++) { const T = buildFireTruck(); T.root.position.set(1150 + i * 16, 0, -235); T.root.rotation.y = -Math.PI / 2; W.scene.add(T.root); FX.trucks.push(T); }
}

/* ── MAYDAY: guarded switch → engine 3 fire → pull the fire handle ── */
function hCover(e) { e.preventDefault(); initA(); const g = $('guard'); if (g.classList.contains('lkd') || g.classList.contains('open')) return;
  g.classList.add('open'); sfx('cover_click'); $('md-hint').textContent = 'PRESS!';
  later(6000, () => { const idle = GAME === 'takeoff' ? TKM.state === 'idle' : LD.mayday === 'idle' && LD.ph; if (idle) { g.classList.remove('open'); $('md-hint').textContent = 'LIFT COVER'; } }); }
function hMayday(e) { e.preventDefault(); initA(); const g = $('guard'); if (!g.classList.contains('open') || g.classList.contains('lkd')) return;
  if (GAME === 'takeoff') return tkMaydayPress();
  if (LD.mayday === 'idle' && (LD.ph === 'APP')) ldDeclareMayday(); else if (LD.mayday === 'fire') ldPullFire(); }
/* shared switch looks (takeoff + landing) */
function mdUiReset() { $('guard').className = ''; $('md-t').textContent = 'MAYDAY'; $('md-lbl').textContent = 'MAYDAY'; $('md-hint').textContent = 'LIFT COVER'; }
function mdUiFire() { const g = $('guard'); g.classList.add('open', 'fire'); $('md-t').textContent = 'PULL FIRE'; $('md-lbl').textContent = 'ENG 3 FIRE'; $('md-hint').textContent = 'PULL HANDLE'; }
function mdUiOut() { const g = $('guard'); g.classList.add('open'); g.classList.remove('fire', 'active'); g.classList.add('done'); $('md-lbl').textContent = 'ENG 3 FIRE'; $('md-t').textContent = 'FIRE OUT'; $('md-hint').textContent = ''; }
/* engine 3 fire + smoke trail, driven by k (0..1) */
function engineFireFx() { const P = RT.plane, e3 = out => P.engines[2].localToWorld(out.set(-2.5, 0, 0));
  return [fxEmitter('fire', e3, 40, { k: 0, scale: 1.1 }), fxEmitter('smoke', e3, 16, { k: 0, scale: .9 })]; }
function ldFireOn() {
  LD.mayday = 'fire'; LD.fire = true; mdUiFire();
  sfx('fire_bell'); const bell = () => { if (LD.fire && LD.ph === 'APP') { sfx('fire_bell'); later(4000, bell); } }; later(4000, bell);
  LD.engFire = engineFireFx();
  later(16000, function remind() { if (LD.mayday === 'fire' && LD.ph === 'APP') { $('guard').classList.add('active'); sfx('master_caution'); ldUrgent('landing.first_officer.fire_remind'); later(12000, remind); } });
}
/* fire trucks roll out and wait beside the runway */
function ldTrucksStandby() { ldSpawnTrucks(); FX.trucks.forEach((T, i) => truckDrive(T, [[T.root.position.x, -235], [T.root.position.x + 200, -160], [2050 + i * 140, -85]], 14)); }
function ldDeclareMayday() {
  ldFireOn(); ldTrucksStandby();
  ldUrgent('landing.captain.mayday_call'); ldSay('landing.tower.mayday_ack'); ldSay('landing.first_officer.fire_handle');
}
function ldPullFire() {
  LD.mayday = 'out'; LD.fire = false; sfx('extinguisher'); mdUiOut();
  ldUrgent('landing.first_officer.fire_out');
}
/* emergency return from Takeoff mode: start Landing already in MAYDAY */
let MD_CARRY = null;
function ldApplyCarry(c) {
  LD.e3 = 0; ldTrucksStandby();
  if (c === 'fire') ldFireOn(); else { LD.mayday = 'out'; mdUiOut(); }
  ldCard('EMERGENCY RETURN', 'Runway ' + AL.rwy + ' ahead', 0);
}

/* ── buttons ── */
function ldPress(id) {
  if (LD.ph === 'APP') {
    const s = LD_STEPS[LD.si];
    if (LD.stepOn && s && s.btn === id) return ldStepDone(s);
    if (id === 'l-flare' && LD.flareOn && !LD.flared) { LD.flared = true; ldLock('l-flare'); $('l-flare').classList.add('lit'); sfx('success'); return; }
  }
  if (LD.ph === 'ROLL') {
    const i = LD_ROLL.findIndex(r => r.btn === id);
    if (i >= 0 && !LD.ri[i]) { LD.ri[i] = true; ldLock(id); $(id).classList.add('lit'); sfx('success');
      if (i === 0) { LD.rev = true; $('kt-lrev').textContent = 'REV'; } else { LD.brk = true; $('kt-lbrk').textContent = 'MAX'; }
      ldSay(LD_ROLL[i].ok); return; }
  }
  fb('WAIT', 'wait');
}
function ldStepDone(s) {
  const P = RT.plane; ldLock(s.btn); LD.stepOn = false; LD.si++; sfx('success');
  if (s.id === 'flaps20' || s.id === 'flaps30') { LD.flaps = s.id === 'flaps20' ? 20 : 30; sfx('flaps_motion'); $('kt-lflaps').textContent = String(LD.flaps); $('l-flaps').classList.add('lit');
    $('fl-up').className = 'fl-cell'; $('fl-10').className = 'fl-cell lit'; $('fl-10').textContent = String(LD.flaps);
    setPreset(s.id === 'flaps20' ? { az: -120, el: 14, dist: 85 } : { az: -60, el: 6, dist: 90 }); }
  if (s.id === 'gear') { LD.gearDown = true; sfx('gear_motion'); $('kt-lgear').textContent = 'DOWN'; $('l-gear').classList.add('lit');
    ['lp-g1', 'lp-g2', 'lp-g3'].forEach(id => $(id).className = 'lamp amb'); later(2600, () => ['lp-g1', 'lp-g2', 'lp-g3'].forEach(id => $(id).className = 'lamp grn'));
    tween(3, k => P.state.gear = 1 - k); setPreset({ az: -95, el: -8, dist: 70 }); }
  if (s.id === 'spd') { LD.spd = true; $('kt-lspd').textContent = 'ARMED'; $('l-spd').classList.add('lit'); }
  ldSay(s.ok);
}
const hL = id => e => { e.preventDefault(); initA(); if ($(id).classList.contains('lkd')) return; ldPress(id); };

/* ── instrument data ── */
function ldInstr() {
  const P = RT.plane, ias = LD.gs * 1.944, air = LD.ph === 'APP' || LD.ph === 'STALL';
  const n1 = P.state.n1 * 100;
  return {
    pfd: { pitch: LD.pitch, roll: LD.roll, ias, mach: ias / 660, alt: Math.max(0, LD.alt), vs: air ? -LD.vs * 60 : 0, hdg: AL.hdg,
      selAlt: 3000, selSpd: 145, selHdg: AL.hdg, fma: LD.flared || LD.ph === 'ROLL' ? ['IDLE', 'ROLLOUT', 'FLARE'] : ['SPEED', 'LOC', 'G/S'], vspd: null },
    nd: { hdg: AL.hdg, range: 10, course: AL.hdg, wp: 'RW' + AL.rwy, gs: ias, tas: ias, storms: [], traffic: [] },
    eicas: { n1: [n1, n1, n1, n1], gear: P.state.gear, flaps: P.state.flaps, msgs: LD.fire ? [{ t: 'FIRE ENG 3', c: COL.red }] : LD.fails.gear ? [{ t: 'CONFIG GEAR', c: COL.red }] : [] },
    mcp: { spd: 145, hdg: AL.hdg, vs: '----', alt: 3000 },
  };
}
function ldEng() {
  const st = RT.plane.state, md = LD.mayday && LD.mayday !== 'idle';
  const msg = LD.ph === 'CRASH' ? 'ENGINES OFF' : LD.fire ? 'FIRE ENG 3' : md ? 'ENG 3 SHUTDOWN' : LD.rev ? 'REVERSE' : LD.ph === 'ROLL' || LD.ph === 'STOP' ? 'IDLE' : LD.flared ? 'IDLE' : 'SPEED MODE';
  return engData(LD.ph === 'CRASH' ? 0 : st.n1, { out: [false, false, md, false], spool: md ? LD.e3 * st.n1 * 100 : 0, fire: [false, false, LD.fireK > .3, false],
    rev: LD.rev, msg, msgCol: LD.fire || LD.ph === 'CRASH' ? COL.red : md ? COL.amber : COL.green });
}
