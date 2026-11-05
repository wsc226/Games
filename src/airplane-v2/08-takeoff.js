/* ═══ TAKEOFF MODE (v1 flow, now in 3D) ═══ */
const S = { AIR: 'AIR', GATE: 'GATE', DOORS: 'DOORS', PUSHRDY: 'PUSHRDY', PUSHING: 'PUSHING', WELRDY: 'WELRDY', PRETAXI: 'PRETAXI', TAXI: 'TAXI',
  HOLD: 'HOLD', TORDY: 'TORDY', ROLL: 'ROLL', AIRB: 'AIRB', CLIMB: 'CLIMB', CLEAN: 'CLEAN', CRUISE: 'CRUISE', END: 'END' };
let ST = S.AIR;
let gearDown = true, flap10 = false, beltOn = true;
let done = {};
let pushProg = 0, thrustProg = 0, vrOn = false, alt = 0;
let pushT = null, thrustT = null, decayT = null, beepT = null, altT = null;
let pushHeld = false, thrustHeld = false, wrongN = {}, wrongLast = null;
const TK = { speed: 0, yBase: 0, pitch: 0, pitchT: 0, vx: 0, callouts: {}, tug: null, bridge: null, clouds: null, deck: null, flapsCmd: 0, gearCmd: 0, ctlCheck: 0 };
const PUSH_CURVE = new THREE.CubicBezierCurve3(new THREE.Vector3(-150, 0, -300), new THREE.Vector3(-150, 0, -245), new THREE.Vector3(-150, 0, -205), new THREE.Vector3(-110, 0, -205));

function setHeadingFromNose(root, d) { root.rotation.y = Math.atan2(-d.z, d.x); }
function tkSetup() {
  const P = RT.plane;
  buildAirport(AL);
  // where is the L1 door when parked?
  P.root.position.set(GATE.x, 0, GATE.z); P.root.rotation.set(0, GATE.rotY, 0); P.root.updateMatrixWorld(true);
  const doorW = P.model.localToWorld(new THREE.Vector3(26.2, 0, -3.4));
  TK.bridge = buildJetBridge(doorW);
  TK.tug = buildTug(); W.airport.add(TK.tug); TK.tug.visible = false;
  // neighbours at the other gates
  RT.others.forEach(o => W.scene.remove(o.root)); RT.others = [];
  const pool = AIRLINES.filter(a => a.id !== AL.id);
  [[-240, 0], [-60, 1]].forEach(([x], i) => { const al = pool[(AIRLINES.indexOf(AL) * 3 + i * 5) % pool.length];
    const o = buildPlane(al, { lite: true }); o.root.position.set(x, 0, -300); o.root.rotation.y = GATE.rotY; o.state.beacon = false; W.scene.add(o.root); RT.others.push(o); });
  TK.deck = cloudDeck(1000, 120000, 6000); TK.deck.group.visible = false;
  TK.clouds = cloudField({ count: 60, yMin: 640, yMax: 1100, radius: 9000, size: 520, mat: W.cloudMat }); TK.clouds.group.visible = false;
  RT.tick = tkTick;
}
function tkTeardown() {
  if (TK.clouds) TK.clouds.dispose(); if (TK.deck) W.scene.remove(TK.deck.group); W.deck = null;
  RT.others.forEach(o => W.scene.remove(o.root)); RT.others = [];
  if (W.airport) { W.scene.remove(W.airport); W.airport = null; }
}

/* ── per-frame ── */
let bulkT = 0;
function tkTick(dt, t) {
  const P = RT.plane, st = P.state;
  st.flaps = damp(st.flaps, TK.flapsCmd, 1.4, dt);
  st.gear = clamp(st.gear + (TK.gearCmd - st.gear) * Math.min(1, dt * .9), 0, 1);
  if (TK.ctlCheck > 0) { TK.ctlCheck -= dt; const k = 6 - TK.ctlCheck; st.ail = k < 2 ? Math.sin(k * Math.PI) : 0; st.elev = k > 2 && k < 4 ? Math.sin((k - 2) * Math.PI) : 0; st.rud = k > 4 ? Math.sin((k - 4) * Math.PI) : 0; st.spoil = k < 2 ? Math.max(0, Math.sin(k * Math.PI)) : 0; }
  else { st.ail = st.elev = st.rud = st.spoil = 0; }
  // takeoff roll
  if (ST === S.ROLL) { TK.speed = thrustProg * .85; P.root.position.x += TK.speed * dt; RT.shake = thrustProg / 100 * .6;
    $('spd-kt').textContent = Math.round(thrustProg * 1.85); st.n1 = .3 + thrustProg / 100 * .68;
    callout(25, 'takeoff.first_officer.thrust_set'); callout(45, 'takeoff.first_officer.eighty_knots'); callout(68, 'takeoff.first_officer.v1');
    if (P.root.position.x > 3300) doRotate(); }
  if ([S.AIRB, S.CLIMB, S.CLEAN, S.CRUISE, S.END].includes(ST)) {
    RT.shake = Math.max(0, RT.shake - dt);
    TK.pitch = damp(TK.pitch, TK.pitchT, 1.2, dt); P.root.rotation.z = TK.pitch * DEG;
    if (ST === S.AIRB) { TK.vx = damp(TK.vx, 85, 1, dt); if (TK.pitch > 7) P.root.position.y = Math.min(260, P.root.position.y + 9 * dt); }
    else { const k = alt / 35000; TK.vx = damp(TK.vx, lerp(95, 260, k), .6, dt); P.root.position.y = damp(P.root.position.y, TK.yBase + alt * .0457, 3, dt);
      TK.pitchT = alt >= 35000 ? 2 : k > .85 ? 5 : 12; }
    P.root.position.x += TK.vx * dt;
    const y = P.root.position.y, k = smooth((alt - 6000) / 26000);
    setEnv(k, y); st.glow = k * .95; st.landing = alt < 10000 && ST !== S.END;
    TK.clouds.group.visible = TK.deck.group.visible = y > 200;
    if (W.airport) W.airport.visible = y < 1400;
    RT.others.forEach(o => o.root.visible = y < 1400);
    TK.clouds.recycle(P.root.position, new THREE.Vector3(1, 0, 0)); TK.deck.follow(P.root.position);
    // inside a cloud? white-out the screen
    let dmin = 1e9; const cp = W.camera.position;
    TK.clouds.items.forEach(c => { const d = c.position.distanceTo(cp); if (d < dmin) dmin = d; });
    $('whiteout').style.opacity = clamp(1 - (dmin - 120) / 380, 0, .92) * (RT.view === 'cabin' ? .3 : 1);
    if (dmin < 400) RT.shake = Math.max(RT.shake, .35);
  } else { setEnv(0, 0); $('whiteout').style.opacity = 0; }
  // cockpit levers + yokes
  if (P.levers) { P.levers.forEach(l => l.rotation.z = -clamp(st.n1 - .25, 0, 1) * .9); P.flapLever.rotation.z = -st.flaps / 10 * .5; P.gearLever.rotation.z = TK.gearCmd ? .6 : -.2;
    P.yokes.forEach(y => { y.col.rotation.z = TK.pitch > 1 && ST === S.AIRB ? .18 : 0; y.wheel.rotation.x = st.ail * .5; }); }
  // cabin & displays
  const cabinOn = RT.view === 'cabin';
  P.cabinLight.intensity = P.cabinLight2.intensity = cabinOn ? lerp(14, 7, W.envK || 0) : 0;
  P.moodMat.color.copy(mixC('#e8eeff', '#b48cff', W.envK || 0));
  P.cockpitLight.intensity = RT.view === 'cockpit' ? 6 + (W.envK || 0) * 6 : 0;
  if (!RT.cmpT || RT.t - RT.cmpT > .25) { RT.cmpT = RT.t; const h = Math.round(wrapDeg(AL.hdg - P.root.rotation.y / DEG)) % 360; $('cmp-b').textContent = String(h).padStart(3, '0') + '°'; $('cmp-p').textContent = ['N','NE','E','SE','S','SW','W','NW'][Math.round(h / 45) % 8]; }
  bulkT -= dt; if (bulkT <= 0 && cabinOn) { bulkT = 1; P.drawBulkhead(alt, phaseName()); }
  RT.instrT -= dt; if (RT.instrT <= 0 && RT.view === 'cockpit') { RT.instrT = .08; refreshInstruments(tkInstr()); }
  const nOn = st.n1 > 0 ? st.n1 : 0; engineSet(ST === S.AIR ? 0 : nOn);
}
function phaseName() { return { GATE: 'Boarding', DOORS: 'Boarding complete', PUSHRDY: 'Ready for pushback', PUSHING: 'Pushing back', WELRDY: 'Engines starting',
  PRETAXI: 'Taxi to runway', TAXI: 'Taxi to runway ' + AL.rwy, HOLD: 'Runway ' + AL.rwy, TORDY: 'Cleared for takeoff', ROLL: 'Takeoff!', AIRB: 'Airborne', CLIMB: 'Climbing',
  CLEAN: 'Climbing', CRUISE: 'Cruising', END: 'Enjoy the flight' }[ST] || ''; }
function tkInstr() {
  const P = RT.plane, hdg = wrapDeg(AL.hdg - P.root.rotation.y / DEG);
  const air = [S.AIRB, S.CLIMB, S.CLEAN, S.CRUISE, S.END].includes(ST);
  const ias = air ? Math.min(290, 165 + alt / 300) : ST === S.ROLL ? thrustProg * 1.85 : 0;
  const n1 = P.state.n1 * 100;
  return {
    pfd: { pitch: TK.pitch, roll: 0, ias,
      mach: alt / 35000 * .85, alt: ST === S.AIRB ? (P.root.position.y * 3.28) : alt, vs: air && alt > 0 && alt < 35000 ? 3000 : ST === S.AIRB ? 1500 : 0,
      hdg, selAlt: 35000, selSpd: alt > 10000 ? 290 : 160, selHdg: AL.hdg, fma: ['THR REF', 'TO/GA', 'TO/GA'] },
    nd: { hdg, range: 20, course: AL.hdg, wp: AL.apt + 'D1', gs: ias, tas: ias, storms: [], traffic: [] },
    eicas: { n1: [n1, n1, n1, n1], gear: P.state.gear, flaps: P.state.flaps, msgs: beltOn ? [{ t: 'SEATBELTS ON', c: '#fff' }] : [] },
    mcp: { spd: alt > 10000 ? 290 : 160, hdg: AL.hdg, vs: '----', alt: 35000 },
  };
}
function callout(th, id) { if (thrustProg >= th && !TK.callouts[id]) { TK.callouts[id] = 1; say(id); } }

/* ── annunciators / buttons (from v1) ── */
function updGear() { ['lp-g1', 'lp-g2', 'lp-g3'].forEach(id => $(id).className = 'lamp' + (gearDown ? ' grn' : '')); $('kt-gear').textContent = gearDown ? 'DOWN' : 'UP'; $('k-gear').classList.toggle('lit', gearDown); }
function gearTransit() { ['lp-g1', 'lp-g2', 'lp-g3'].forEach(id => $(id).className = 'lamp amb'); later(2600, updGear); }
function updFlaps() { $('fl-up').className = 'fl-cell' + (flap10 ? '' : ' lit'); $('fl-10').className = 'fl-cell' + (flap10 ? ' lit' : ''); $('kt-flaps').textContent = flap10 ? '10' : 'UP'; $('k-flaps').classList.toggle('lit', flap10); TK.flapsCmd = flap10 ? 10 : 0; }
function updBelt(sound = true) { $('lp-belt').className = 'lamp' + (beltOn ? ' amb' : ''); $('kt-belt').textContent = beltOn ? 'ON' : 'OFF'; $('k-belt').classList.toggle('lit-a', beltOn);
  RT.plane.setBelt && RT.plane.setBelt(beltOn); if (sound) sfx('seatbelt_ding'); }
function wrong(act) {
  if (act !== wrongLast) { wrongLast = act; wrongN = {}; } wrongN[act] = (wrongN[act] || 0) + 1;
  if (wrongN[act] >= 3) { const map = { DOORS: 'k-ann', PUSH: 'k-push', SPEAK: 'k-ann', FLAPS: 'k-flaps', HOLD: 'k-thrust' }; const b = $(map[act]);
    if (b && !b.classList.contains('lkd')) { b.classList.add('guide'); later(3200, () => { if (level !== 'easy') b.classList.remove('guide'); }); } wrongN[act] = 0; }
}
const KEYS = ['k-push', 'k-thrust', 'k-flaps', 'k-gear', 'k-belt', 'k-ann'];
function lockAll() { KEYS.forEach(id => { const b = $(id); b.classList.add('lkd'); b.classList.remove('guide', 'held'); }); }
function unlock(...ids) { ids.forEach(id => $(id).classList.remove('lkd')); }
function guide(...ids) { if (level === 'easy') ids.forEach(id => $(id).classList.add('guide')); }
function updBtns() {
  lockAll();
  switch (ST) {
    case S.GATE: unlock('k-ann', 'k-belt'); guide('k-ann'); break;
    case S.PUSHRDY: unlock('k-push', 'k-belt'); guide('k-push'); break;
    case S.WELRDY: unlock('k-ann', 'k-belt'); guide('k-ann'); break;
    case S.HOLD: unlock('k-ann', 'k-flaps', 'k-gear', 'k-belt'); guide(flap10 ? 'k-ann' : 'k-flaps'); break;
    case S.TORDY: unlock('k-thrust', 'k-gear'); guide('k-thrust'); break;
    case S.ROLL: unlock('k-thrust', 'k-gear'); break;
    case S.AIRB: unlock('k-gear', 'k-belt'); guide('k-gear'); break;
    case S.CLIMB: unlock('k-flaps', 'k-belt'); guide('k-flaps'); break;
    case S.CRUISE: unlock('k-ann', 'k-belt'); guide('k-ann'); break;
  }
  $$('.lvl').forEach(b => b.classList.toggle('lkd', ST === S.ROLL || ST === S.PUSHING));
  updDrawer();
}
function updDrawer() {
  const av = { doors: ST === S.GATE && !done.doors, welcome: ST === S.WELRDY && !done.welcome, takeoff: ST === S.HOLD && flap10 && !done.takeoff, cruise: ST === S.CRUISE && !done.cruise };
  ['doors', 'welcome', 'takeoff', 'cruise'].forEach(k => { const b = $('a-' + k); b.className = 'korry' + (done[k] ? ' done' : av[k] ? ' lit' : ' lkd'); b.querySelector('.kbar-t').textContent = done[k] ? 'DONE' : 'SPEAK'; });
}
function openDrawer() { $('ann-drawer').classList.add('open'); updDrawer(); }
function closeDrawer() { $('ann-drawer').classList.remove('open'); }
function goTo(s) { ST = s; updBtns(); }
function hud(id, on) { $(id).classList.toggle('hs', on); }

/* ── flow ── */
function enterGate() {
  const P = RT.plane; goTo(S.GATE);
  gearDown = true; flap10 = false; beltOn = true; updGear(); updFlaps(); updBelt(false);
  Object.assign(P.state, { flaps: 0, gear: 0, door: 1, n1: 0, beacon: false, strobes: false, landing: false, taxiLight: false, glow: 0 });
  TK.flapsCmd = 0; TK.gearCmd = 0; TK.pitch = TK.pitchT = 0; TK.vx = 0; TK.callouts = {}; alt = 0;
  P.root.position.set(GATE.x, 0, GATE.z); P.root.rotation.set(0, GATE.rotY, 0);
  TK.bridge.set(1); TK.tug.visible = false; if (TK.tug.parent !== W.airport) W.airport.add(TK.tug);
  W.airport.visible = true; RT.others.forEach(o => o.root.visible = true); TK.clouds.group.visible = TK.deck.group.visible = false;
  $('hud-gate').textContent = 'GATE ' + AL.gate; hud('hud-gate', true); hud('hud-alt', false); hud('hud-cmp', false); hud('taxi-l', false);
  $('hud-alt').textContent = '00000 FT';
  setPreset({ az: -125, el: 14, dist: 95 }, true); RT.autoOrbit = 0;
  later(1400, () => { if (ST === S.GATE) say('takeoff.purser.boarding_welcome'); });
}
function doDoors() {
  goTo(S.DOORS); lockAll();
  say('takeoff.purser.doors_closed', { cb: () => {
    sfx('door_close'); tween(2, k => RT.plane.state.door = 1 - k);
    later(1200, () => { say('takeoff.purser.arm_doors'); tween(3.2, k => TK.bridge.set(1 - k)); setPreset({ az: 95, el: 30, dist: 110 }); });
    later(4600, () => {
      const tug = TK.tug; RT.plane.model.add(tug); tug.position.set(64, GEAR_GROUND, 0); tug.rotation.set(0, 0, 0); tug.visible = true;
      tween(2.6, k => tug.position.x = lerp(64, 34.4, smooth(k)), () => {
        RT.plane.state.beacon = true;
        say('takeoff.ramp.ready_for_push'); fb('SEALED', 'ok'); sfx('success_big'); goTo(S.PUSHRDY);
      });
    });
  } });
}
function setPushPos() {
  const P = RT.plane, u = pushProg / 100, p = PUSH_CURVE.getPoint(u), tg = PUSH_CURVE.getTangent(Math.max(u, .001));
  P.root.position.copy(p); setHeadingFromNose(P.root, tg.clone().negate());
}
function pushStart() {
  goTo(S.PUSHING);
  if (pushProg === 0) { sfx('engine_start'); say('takeoff.ramp.pushing_back'); setPreset({ az: 140, el: 28, dist: 120 }); tween(4, k => RT.plane.state.n1 = k * .22); }
  beepT = setInterval(() => sfx('pushback_beep', .5), 800);
}
function pushPause() { clearInterval(beepT); beepT = null; goTo(S.PUSHRDY); }
function pushDone() {
  clearInterval(beepT); beepT = null;
  const tug = TK.tug; tug.updateMatrixWorld(true); W.airport.attach(tug);
  const start = tug.position.clone(), yaw0 = tug.rotation.y;
  later(1500, () => tween(7, k => { tug.rotation.y = yaw0 + k * 1.4; const f = new THREE.Vector3(Math.cos(tug.rotation.y), 0, -Math.sin(tug.rotation.y)); tug.position.addScaledVector(f, .25 + k * .3); }, () => tug.visible = false));
  void start;
  say('takeoff.ramp.push_complete');
  fb('READY', 'ok'); sfx('success_big'); goTo(S.WELRDY);
}
function doWelcome() {
  goTo(S.PRETAXI); lockAll();
  say('takeoff.captain.welcome', { cb: () => {
    goTo(S.TAXI); lockAll(); hud('hud-gate', false); hud('taxi-l', true); hud('hud-cmp', true);
    RT.plane.state.taxiLight = true; tween(3, k => RT.plane.state.n1 = .22 + k * .1);
    say('takeoff.ground.taxi_clearance', { cb: () => later(1500, () => say('takeoff.purser.safety_check')) });
    setPreset({ az: 205, el: 15, dist: 85 });
    const curve = W.taxiCurve, P = RT.plane, dur = 19;
    tween(dur, k => { const u = k < .1 ? k * k * 5 : k > .9 ? 1 - (1 - k) * (1 - k) * 5 : .05 + (k - .1) * 1.125;
      const p = curve.getPointAt(clamp(u, 0, 1)); P.root.position.set(p.x, 0, p.z); setHeadingFromNose(P.root, curve.getTangentAt(clamp(u, .001, .999)));
      if (k > .55 && !TK.didCheck) { TK.didCheck = 1; TK.ctlCheck = 6; setPreset({ az: 150, el: 22, dist: 75 }); }
    }, () => {
      P.root.position.copy(LINEUP); P.root.rotation.set(0, 0, 0); TK.didCheck = 0;
      hud('taxi-l', false); setPreset({ az: -60, el: 10, dist: 85 });
      say('takeoff.tower.line_up'); goTo(S.HOLD);
    });
  } });
}
function doTakeoffAnn() {
  goTo(S.TORDY); lockAll();
  say('takeoff.captain.crew_seats', { cb: () => later(900, () => say('takeoff.tower.takeoff_clearance', { cb: () => {
    done.takeoff = true; RT.plane.state.strobes = true; RT.plane.state.landing = true; fb('GO', 'ok'); goTo(S.TORDY); setPreset({ az: -165, el: 7, dist: 70 });
  } })) });
}
/* PUSH hold */
function pushHoldStart() {
  if (ST !== S.PUSHRDY) return; pushHeld = true; $('k-push').classList.add('held'); pushStart();
  pushT = setInterval(() => { pushProg = Math.min(100, pushProg + .8); $('pf').style.width = pushProg + '%'; setPushPos();
    if (pushProg >= 100) { clearInterval(pushT); pushT = null; pushDone(); $('k-push').classList.remove('held'); $('pf').style.width = '0%'; } }, 50);
}
function pushHoldEnd() { if (!pushHeld) return; pushHeld = false; clearInterval(pushT); pushT = null; $('k-push').classList.remove('held'); if (ST === S.PUSHING) pushPause(); }
/* THRUST hold + rotate window */
function thrustHoldStart() {
  if (ST !== S.TORDY && ST !== S.ROLL) return;
  if (ST === S.TORDY) { goTo(S.ROLL); $('spd-wrap').classList.add('show'); sfx('engine_start'); }
  thrustHeld = true; $('k-thrust').classList.add('held'); clearInterval(decayT); decayT = null;
  const total = level === 'easy' ? 4200 : 7000;
  thrustT = setInterval(() => { thrustProg = Math.min(100, thrustProg + (50 / total * 100)); $('tf').style.width = thrustProg + '%'; $('spd-fill').style.width = thrustProg + '%'; chkVr(); }, 50);
}
function thrustHoldEnd() {
  if (!thrustHeld) return; thrustHeld = false; clearInterval(thrustT); thrustT = null; $('k-thrust').classList.remove('held');
  if (ST === S.ROLL) decayT = setInterval(() => { thrustProg = Math.max(0, thrustProg - 1.4); $('tf').style.width = thrustProg + '%'; $('spd-fill').style.width = thrustProg + '%'; chkVr();
    if (thrustProg <= 0 || ST !== S.ROLL) clearInterval(decayT); }, 90);
}
function chkVr() {
  const inZone = thrustProg >= 78;
  if (inZone && !vrOn) { vrOn = true; $('rotate-b').classList.add('show'); sfx('rotate_cue'); say('takeoff.first_officer.rotate');
    if (level === 'easy') later(1300, () => { if (ST === S.ROLL && thrustProg >= 78) doRotate(); }); }
  else if (!inZone && vrOn && thrustProg < 70) { vrOn = false; $('rotate-b').classList.remove('show'); }
}
function doRotate() {
  if (ST !== S.ROLL) return;
  vrOn = false; $('rotate-b').classList.remove('show');
  clearInterval(thrustT); thrustT = null; thrustHeld = false; clearInterval(decayT); decayT = null;
  $('k-thrust').classList.remove('held'); $('tf').style.width = '0%'; $('spd-wrap').classList.remove('show');
  TK.vx = TK.speed; TK.pitchT = 11; RT.plane.state.n1 = .98;
  goTo(S.AIRB); fb('UP', 'ok'); sfx('success_big'); hud('hud-alt', true);
  setPreset({ az: -110, el: -6, dist: 80 });
  later(2200, () => { if (ST === S.AIRB) say('takeoff.first_officer.positive_rate'); });
}
function gearUpInAir() {
  gearDown = false; sfx('gear_motion'); gearTransit(); TK.gearCmd = 1;
  $('kt-gear').textContent = 'UP'; $('k-gear').classList.remove('lit'); fb('GEAR UP', 'ok'); say('takeoff.captain.gear_up');
  TK.yBase = RT.plane.root.position.y;
  goTo(S.CLIMB); altStart(); setPreset({ az: -70, el: 4, dist: 95 });
  later(5000, () => say('takeoff.tower.contact_departure'));
}
function gearResist() {
  sfx('gear_horn'); const b = $('k-gear'); b.classList.remove('resist'); void b.offsetWidth; b.classList.add('resist');
  ['lp-g1', 'lp-g2', 'lp-g3'].forEach(id => { $(id).className = 'lamp amb'; later(1600, () => $(id).className = 'lamp grn'); }); fb('WAIT', 'wait');
}
function altStart() { alt = 0; altT = setInterval(() => { alt = Math.min(35000, alt + 150); $('hud-alt').textContent = String(alt).padStart(5, '0') + ' FT'; if (alt >= 35000) { clearInterval(altT); altT = null; } }, 100); }
function flapsClean() {
  flap10 = false; sfx('flaps_motion'); updFlaps(); say('takeoff.captain.flaps_up');
  goTo(S.CLEAN); lockAll(); setPreset({ az: 35, el: 12, dist: 110 });
  later(2100, () => { fb('CRUISE', 'ok'); sfx('cruise_jingle'); goTo(S.CRUISE); });
}
/* ── handlers ── */
function hPushS(e) { e.preventDefault(); initA(); if (ST === S.PUSHRDY) pushHoldStart(); else if (ST === S.GATE) { fb('DOORS', 'err'); wrong('DOORS'); } }
function hPushE(e) { e && e.preventDefault(); pushHoldEnd(); }
function hThrS(e) {
  e.preventDefault(); initA();
  if (ST === S.TORDY || ST === S.ROLL) thrustHoldStart();
  else if (ST === S.GATE) { fb('DOORS', 'err'); wrong('DOORS'); }
  else if (ST === S.PUSHRDY || ST === S.PUSHING) { fb('PUSH', 'err'); wrong('PUSH'); }
  else if (ST === S.WELRDY) { fb('SPEAK', 'err'); wrong('SPEAK'); }
  else if (ST === S.HOLD) { if (!flap10) { fb('FLAPS', 'wait'); wrong('FLAPS'); } else { fb('SPEAK', 'err'); wrong('SPEAK'); } }
  else fb('WAIT', 'wait');
}
function hThrE(e) { e && e.preventDefault(); thrustHoldEnd(); }
function hFlaps(e) { e.preventDefault(); initA();
  if (ST === S.HOLD) { flap10 = !flap10; sfx('flaps_motion'); updFlaps(); updBtns(); if (flap10) { say('takeoff.first_officer.flaps_10'); setPreset({ az: 120, el: 25, dist: 70 }); } }
  else if (ST === S.CLIMB) flapsClean(); else { fb('WAIT', 'wait'); wrong('WAIT'); } }
function hGear(e) { e.preventDefault(); initA();
  if (ST === S.AIRB) gearUpInAir(); else if (gearDown && [S.HOLD, S.ROLL, S.GATE, S.PUSHRDY, S.PUSHING, S.WELRDY, S.TORDY].includes(ST)) gearResist(); else fb('WAIT', 'wait'); }
function hBelt(e) { e.preventDefault(); initA(); if ([S.GATE, S.PUSHRDY, S.WELRDY, S.HOLD, S.CRUISE, S.AIRB, S.CLIMB].includes(ST)) { beltOn = !beltOn; updBelt(); } }
function hAnn(e) { e.preventDefault(); initA(); if ($('k-ann').classList.contains('lkd')) return; openDrawer(); }
function hADoors(e) { e.preventDefault(); if (done.doors || ST !== S.GATE) return; done.doors = true; closeDrawer(); doDoors(); }
function hAWel(e) { e.preventDefault(); if (done.welcome || ST !== S.WELRDY) return; done.welcome = true; closeDrawer(); doWelcome(); }
function hATO(e) { e.preventDefault(); if (done.takeoff || ST !== S.HOLD) return; if (!flap10) { fb('FLAPS', 'wait'); closeDrawer(); return; } closeDrawer(); doTakeoffAnn(); }
function hACruise(e) { e.preventDefault(); if (done.cruise || ST !== S.CRUISE) return; done.cruise = true; closeDrawer(); lockAll();
  say('takeoff.captain.cruise', { cb: () => { beltOn = false; updBelt(); goTo(S.END);
    later(1200, () => say('takeoff.purser.service'));
    RT.autoOrbit = 9; setPreset({ el: 10, dist: 120 });
    later(2500, () => { $('end-t').textContent = 'WELL DONE'; $('end-s').textContent = `${AL.name} is cruising at 35,000 ft`; $('end-ov').classList.add('show'); }); } }); }
function hRotate(e) { e.preventDefault(); initA(); if ($('rotate-b').classList.contains('show')) doRotate(); }

function tkReset() {
  ST = S.AIR; gearDown = true; flap10 = false; beltOn = true; done = {};
  pushProg = 0; thrustProg = 0; vrOn = false; alt = 0;
  [pushT, thrustT, decayT, beepT, altT].forEach(t => clearInterval(t)); pushT = thrustT = decayT = beepT = altT = null;
  pushHeld = thrustHeld = false; wrongN = {}; wrongLast = null; TK.callouts = {}; TK.ctlCheck = 0; TK.didCheck = 0; RT.shake = 0;
  $('fb').className = ''; $('rotate-b').classList.remove('show'); $('end-ov').classList.remove('show'); $('spd-wrap').classList.remove('show');
  $('spd-fill').style.width = '0%'; $('pf').style.width = '0%'; $('tf').style.width = '0%';
  closeDrawer();
}
function tkStart() {
  document.body.classList.remove('sky'); tkSetup(); tkReset(); setView('chase'); enterGate();
}
