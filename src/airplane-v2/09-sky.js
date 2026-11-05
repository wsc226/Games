/* ═══ SKY CHALLENGE: hand-fly the 747 at cruise, pilot view only ═══
   World scale here is real: y metres = altitude ft × 0.3048.
   Heading 0 = north = −Z, 90 = east = +X. */
const FT = .3048, TAS = 247; // m/s (~480 kt)
const SKY = { alt: 35000, hdg: 90, pitch: 0, roll: 0, vs: 0, pos: new THREE.Vector3(), stick: { x: 0, y: 0 }, keys: {}, autoLevel: true,
  selAlt: 35000, assigned: 35000, stars: 0, idx: 0, ch: null, storms: [], traffic: null, deck: null, clouds: null, turb: 0, inStorm: false, belt: true, done: false };
const CH_ORDER = ['intro', 'climb', 'storm', 'descend', 'traffic', 'stormfield', 'climb', 'traffic'];

function skySetup() {
  document.body.classList.add('sky');
  tkTeardown();
  ['hud-gate', 'hud-alt', 'hud-cmp', 'taxi-l'].forEach(id => hud(id, false));
  SKY.deck = cloudDeck(6100, 200000, 9000);
  SKY.clouds = cloudField({ count: 50, yMin: 5900, yMax: 6900, radius: 26000, size: 1400, mat: W.cloudMat });
  RT.tick = skyTick;
}
function skyTeardown() {
  if (SKY.deck) { W.scene.remove(SKY.deck.group); SKY.deck = null; W.deck = null; }
  if (SKY.clouds) { SKY.clouds.dispose(); SKY.clouds = null; }
  SKY.storms.forEach(s => W.scene.remove(s)); SKY.storms = [];
  if (SKY.traffic) { W.scene.remove(SKY.traffic.p.root); SKY.traffic = null; }
  turbulenceSound(false); document.body.classList.remove('sky');
}
function skyStart() {
  initA(); skySetup();
  Object.assign(SKY, { alt: 35000, hdg: 90, pitch: 0, roll: 0, vs: 0, selAlt: 35000, assigned: 35000, stars: 0, idx: 0, ch: null, turb: 0, inStorm: false, belt: true, done: false });
  SKY.autoLevel = level === 'easy'; $('sb-level').classList.toggle('on', SKY.autoLevel);
  SKY.belt = true; $('sb-belt').classList.add('on'); RT.plane.setBelt(true);
  SKY.pos.set(0, SKY.alt * FT, 0);
  const P = RT.plane; Object.assign(P.state, { flaps: 0, gear: 1, door: 0, n1: .82, beacon: true, strobes: true, landing: false, taxiLight: false, glow: 0 });
  TK.flapsCmd = 0; P.state.gear = 1;
  setView('pilot'); RT.pitchBias = 0;
  setEnv(.32, 3000, { fogNear: 8000, fogFar: 90000 });
  $('stars').textContent = '★ 0'; $('end-ov').classList.remove('show');
  $('stick-hint').classList.add('show');
  resize();
  later(800, () => say('sky.captain.welcome', { cb: () => later(400, () => say('sky.center.radar_contact')) }));
  later(1500, nextChallenge);
}

/* ── challenges ── */
function mission(label, text, prog = 0) { $('ms-k').textContent = label; $('ms-t').textContent = text; $('ms-bar').style.width = (clamp(prog, 0, 1) * 100) + '%'; }
function award(n, msg) {
  SKY.stars += n; $('stars').textContent = '★ ' + SKY.stars;
  fb(n >= 3 ? '★★★' : n === 2 ? '★★' : '★', 'ok'); sfx('cruise_jingle');
  if (n >= 3) later(900, () => say('sky.first_officer.great_job'));
  SKY.ch = null; mission('NICE!', msg || 'Challenge complete', 1);
  later(4500, nextChallenge);
}
function failCh(lineId = 'sky.first_officer.try_again') {
  sfx('master_caution'); fb('TRY AGAIN', 'wait'); const k = SKY.ch.kind; SKY.ch = null;
  say(lineId); SKY.idx--; mission('OOPS', 'Let\'s try that again…', 0);
  cleanupHazards(); later(4500, () => nextChallenge(k));
}
function cleanupHazards() {
  SKY.storms.forEach(s => W.scene.remove(s)); SKY.storms = [];
  if (SKY.traffic) { W.scene.remove(SKY.traffic.p.root); SKY.traffic = null; }
}
function fwd(h) { return new THREE.Vector3(Math.sin(h * DEG), 0, -Math.cos(h * DEG)); }
function pickFL(dir) {
  const fls = SCRIPTS.variants.fl.filter(f => dir > 0 ? f * 100 > SKY.alt + 900 : f * 100 < SKY.alt - 900);
  return dir > 0 ? fls[0] : fls[fls.length - 1];
}
function nextChallenge(forceKind) {
  if (SKY.done) return;
  if (!forceKind && SKY.idx >= CH_ORDER.length) return skyFinish();
  const kind = forceKind || CH_ORDER[SKY.idx]; SKY.idx++;
  const n = SKY.idx, lbl = `CHALLENGE ${n} OF ${CH_ORDER.length}`;
  if (kind === 'intro') { SKY.ch = { kind, t: 0, need: 12 }; mission(lbl + ' · WARM-UP', 'Fly level at 35,000 ft. Try gentle turns left and right.'); return; }
  if (kind === 'climb' || kind === 'descend') {
    let fl = pickFL(kind === 'climb' ? 1 : -1); let k2 = kind;
    if (!fl) { k2 = kind === 'climb' ? 'descend' : 'climb'; fl = pickFL(k2 === 'climb' ? 1 : -1); }
    SKY.selAlt = SKY.assigned = fl * 100;
    SKY.ch = { kind: 'alt', dir: k2, t: 0, hold: 0, target: fl * 100, warned: false, start: SKY.alt, overshoot: 0 };
    mission(lbl + ' · ATC', `${k2 === 'climb' ? '⬆ Climb' : '⬇ Descend'} to ${(fl * 100).toLocaleString()} ft and hold it`);
    say('sky.center.' + k2, { variant: fl, cb: () => say('sky.first_officer.readback_' + k2, { variant: fl }) });
    return;
  }
  if (kind === 'storm' || kind === 'stormfield') {
    const f = fwd(SKY.hdg), right = new THREE.Vector3(-f.z, 0, f.x);
    const cells = kind === 'storm' ? [[24000, 0, 4200]] : [[22000, -5200, 3300], [26000, 5600, 3600], [33000, -400, 3800]];
    cells.forEach(([d, lat, r]) => { const c = stormCell(r, 5600, 13700); c.position.copy(SKY.pos).addScaledVector(f, d).addScaledVector(right, lat); c.position.y = 0; W.scene.add(c); SKY.storms.push(c); });
    SKY.ch = { kind: 'storm', t: 0, inside: 0, beltAsked: !SKY.belt, start: SKY.pos.clone(), dir: f.clone(), passD: Math.max(...cells.map(c => c[0])) + 5000, devHdg: null };
    mission(lbl + ' · STORM', SKY.belt ? 'Storm ahead! Turn LEFT or RIGHT to fly around it ⛈' : 'Storm ahead! Turn the SEATBELT sign ON, then fly around it ⛈');
    if (!SKY.belt) $('sb-belt').classList.add('guide');
    say('sky.center.weather_ahead', { cb: () => say('sky.first_officer.weather_readback', { cb: () => later(600, () => say('sky.captain.turbulence_pa')) }) });
    return;
  }
  if (kind === 'traffic') {
    const al = AIRLINES[(AIRLINES.indexOf(AL) + 3 + n) % AIRLINES.length];
    const p = buildPlane(al, { lite: true }); Object.assign(p.state, { gear: 1, n1: .8, beacon: true, strobes: true, landing: true });
    const f = fwd(SKY.hdg), right = new THREE.Vector3(-f.z, 0, f.x);
    const pos = SKY.pos.clone().addScaledVector(f, 30000).addScaledVector(right, rnd(-150, 150)); pos.y = SKY.alt * FT + rnd(-30, 30);
    const raDir = Math.random() < .6 ? 'CLIMB' : 'DESCEND';
    SKY.traffic = { p, pos, hdg: wrapDeg(SKY.hdg + 180), vs: 0, level: 'other', raDir, cpa: false, minSep: 1e9, ta: false, ra: false };
    p.root.position.copy(pos); W.scene.add(p.root);
    SKY.ch = { kind: 'traffic', t: 0 };
    mission(lbl + ' · TRAFFIC', 'Another plane is coming! Watch the radar screen 👀');
    say('sky.center.traffic_advisory', { cb: () => say('sky.first_officer.looking') });
    return;
  }
}
function skyFinish() {
  SKY.done = true; SKY.ch = null; mission('ALL DONE', 'Great flying, Captain!', 1);
  say('sky.center.goodbye');
  later(2500, () => { $('end-t').textContent = 'SKY CHALLENGE COMPLETE'; $('end-s').textContent = `You earned ★ ${SKY.stars} of ${CH_ORDER.length * 3}`; $('end-ov').classList.add('show'); });
}

/* ── flight model + challenge logic ── */
let skyInstrT = 0;
function skyTick(dt, t) {
  const P = RT.plane, k = SKY.keys;
  let sx = SKY.stick.x + (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0);
  let sy = SKY.stick.y + (k.ArrowUp || k.w ? 1 : 0) - (k.ArrowDown || k.s ? 1 : 0);
  sx = clamp(sx, -1, 1); sy = clamp(sy, -1, 1);
  const bankLim = level === 'easy' ? 30 : 35, pitchLim = level === 'easy' ? 8 : 12;
  SKY.roll += sx * 32 * dt; SKY.pitch += sy * 5 * dt;
  if (SKY.autoLevel) { if (Math.abs(sx) < .05) SKY.roll = damp(SKY.roll, 0, 1.4, dt); if (Math.abs(sy) < .05) SKY.pitch = damp(SKY.pitch, 0, 1.0, dt); }
  // turbulence
  if (SKY.turb > 0) { SKY.roll += rnd(-1, 1) * SKY.turb * 60 * dt; SKY.pitch += rnd(-1, 1) * SKY.turb * 14 * dt; RT.shake = SKY.turb * 1.4; } else RT.shake = 0;
  SKY.roll = clamp(SKY.roll, -bankLim - 8, bankLim + 8); SKY.pitch = clamp(SKY.pitch, -pitchLim, pitchLim);
  SKY.hdg = wrapDeg(SKY.hdg + 7.5 * Math.tan(SKY.roll * DEG) * dt);
  const gam = SKY.pitch * DEG * .9;
  SKY.vs = TAS * Math.sin(gam) * 196.85;
  SKY.alt = clamp(SKY.alt + SKY.vs / 60 * dt, 25000, 43000);
  const f = fwd(SKY.hdg); SKY.pos.addScaledVector(f, TAS * Math.cos(gam) * dt); SKY.pos.y = SKY.alt * FT;
  P.root.position.copy(SKY.pos); P.root.rotation.set(SKY.roll * DEG, Math.PI / 2 - SKY.hdg * DEG, SKY.pitch * DEG);
  P.state.ail = clamp(sx, -1, 1) * .6; P.state.elev = sy * .5;
  if (P.yokes) P.yokes.forEach(y => { y.wheel.rotation.x = sx * .6; y.col.rotation.z = sy * .15; });
  if (P.levers) P.levers.forEach(l => l.rotation.z = -.55);
  SKY.deck.follow(SKY.pos); SKY.clouds.recycle(SKY.pos, f);
  // storms
  let turb = 0, inside = false;
  SKY.storms.forEach(c => { const dx = c.position.x - SKY.pos.x, dz = c.position.z - SKY.pos.z, d = Math.hypot(dx, dz), r = c.userData.radius;
    tickStorm(c, dt, d < r * 6);
    if (d < r * .9) { inside = true; turb = Math.max(turb, .9); } else if (d < r * 1.35) turb = Math.max(turb, .25 * (1.35 - d / r) / .45); });
  SKY.turb = damp(SKY.turb, turb, 3, dt); turbulenceSound(SKY.turb > .3);
  if (inside && !SKY.inStorm) { say('sky.first_officer.turbulence'); fb('BUMPY!', 'wait'); }
  SKY.inStorm = inside;
  // traffic
  const T = SKY.traffic;
  if (T) {
    const tf = fwd(T.hdg); T.pos.addScaledVector(tf, TAS * dt); T.pos.y += T.vs / 196.85 * dt;
    T.p.root.position.copy(T.pos); T.p.root.rotation.set(0, Math.PI / 2 - T.hdg * DEG, 0);
    const rel = T.pos.clone().sub(SKY.pos), horiz = Math.hypot(rel.x, rel.z), dAlt = rel.y / FT;
    const closing = -(rel.x * (tf.x - f.x) + rel.z * (tf.z - f.z)) / Math.max(horiz, 1) * TAS; // m/s
    const tcpa = horiz / Math.max(closing, 1);
    const ahead = rel.x * f.x + rel.z * f.z > 0;
    if (ahead && tcpa < 32 && !T.ta) { T.ta = true; T.level = 'TA'; say('sky.tcas.traffic'); sfx('master_caution'); mission('TRAFFIC!', 'Traffic, traffic! Get ready…', .3); }
    if (ahead && tcpa < 20 && !T.ra) { T.ra = true; T.level = 'RA'; say(T.raDir === 'CLIMB' ? 'sky.tcas.climb' : 'sky.tcas.descend'); T.vs = T.raDir === 'CLIMB' ? -1500 : 1500;
      mission('TCAS', T.raDir === 'CLIMB' ? '⬆ CLIMB! Pull up now!' : '⬇ DESCEND! Push down now!', .6); fb(T.raDir === 'CLIMB' ? 'CLIMB!' : 'DESCEND!', 'err'); }
    if (horiz < 2000) T.minSep = Math.min(T.minSep, Math.abs(dAlt) + (horiz > 600 ? 1e4 : 0));
    if (!ahead && horiz > 2500 && !T.cpa) {
      T.cpa = true; const sep = T.minSep;
      if (sep < 450) { failCh('sky.first_officer.too_close'); }
      else { say('sky.tcas.clear', { cb: () => say('sky.center.traffic_no_factor') }); const stars = sep > 900 ? 3 : sep > 650 ? 2 : 1; T.level = 'other'; award(stars, `Safe! You missed it by ${Math.round(sep)} ft`);
        later(8000, () => { W.scene.remove(T.p.root); if (SKY.traffic === T) SKY.traffic = null; }); }
    }
  }
  // current challenge
  const C = SKY.ch;
  if (C) { C.t += dt;
    if (C.kind === 'intro') { mission($('ms-k').textContent, 'Fly level at 35,000 ft. Try gentle turns left and right.', C.t / C.need); if (C.t >= C.need) award(3, 'Warm-up done!'); }
    else if (C.kind === 'alt') {
      const err = SKY.alt - C.target; const toGo = Math.abs(err);
      if (!C.warned && toGo < 1000) { C.warned = true; say('sky.first_officer.one_thousand_to_go'); }
      if ((C.dir === 'climb' && err > 0) || (C.dir === 'descend' && err < 0)) C.overshoot = Math.max(C.overshoot, toGo);
      if (toGo < 150) C.hold += dt; else C.hold = Math.max(0, C.hold - dt * .5);
      const prog = .75 * clamp(1 - toGo / Math.abs(C.target - C.start), 0, 1) + .25 * C.hold / 4;
      mission($('ms-k').textContent, `${C.dir === 'climb' ? '⬆ Climb' : '⬇ Descend'} to ${C.target.toLocaleString()} ft · ${toGo < 150 ? 'HOLD IT!' : Math.round(toGo / 10) * 10 + ' ft to go'}`, prog);
      if (C.hold >= 4) { say('sky.center.altitude_good'); award(C.t < 50 && C.overshoot < 300 ? 3 : C.t < 75 ? 2 : 1, `Level at ${C.target.toLocaleString()} ft`); }
      else if (C.t > 120) failCh();
    } else if (C.kind === 'storm') {
      if (inside) C.inside += dt;
      if (!SKY.belt && !C.beltNag && C.t > 8) { C.beltNag = true; fb('SEATBELT', 'wait'); }
      const along = SKY.pos.clone().sub(C.start).dot(C.dir);
      const pr = clamp(along / C.passD, 0, 1); mission($('ms-k').textContent, inside ? 'Get out of the storm! Turn away!' : SKY.belt ? 'Fly around the storm ⛈' : 'Turn the SEATBELT sign ON ⛈', pr);
      if (along > C.passD) { say('sky.center.clear_of_weather'); const beltOk = SKY.belt ? 0 : 1;
        award(clamp((C.inside < .5 ? 3 : C.inside < 5 ? 2 : 1) - beltOk, 1, 3), C.inside < .5 ? 'Smooth flying – no bumps!' : 'Made it through the storm');
        const gone = SKY.storms.slice(); later(15000, () => gone.forEach(s => { W.scene.remove(s); SKY.storms = SKY.storms.filter(x => x !== s); })); }
      else if (C.t > 200) failCh();
    } else if (C.kind === 'traffic' && C.t > 150) failCh();
  }
  // displays
  skyInstrT -= dt; if (skyInstrT <= 0) { skyInstrT = .066; refreshInstruments(skyInstr(), { dom: true }); }
  $('mcp-alt').textContent = SKY.selAlt; $('mcp-hdg').textContent = String(Math.round(SKY.hdg) % 360).padStart(3, '0');
  P.cockpitLight.intensity = 6;
  engineSet(.55);
}
function fdFor() {
  if (level !== 'easy') return null;
  const T = SKY.traffic; let tvs = clamp((SKY.selAlt - SKY.alt) * 2.5, -3000, 3000);
  if (T && T.ra && !T.cpa) tvs = T.raDir === 'CLIMB' ? 2500 : -2500;
  const tp = Math.asin(clamp(tvs / 196.85 / TAS, -1, 1)) / DEG / .9;
  let tb = 0; const C = SKY.ch;
  if (C && C.kind === 'storm' && SKY.storms.length) {
    // steer to keep the nearest storm off the nose
    let best = null, bd = 1e9; SKY.storms.forEach(c => { const d = c.position.distanceTo(new THREE.Vector3(SKY.pos.x, 0, SKY.pos.z)); if (d < bd) { bd = d; best = c; } });
    const brg = wrapDeg(Math.atan2(best.position.x - SKY.pos.x, -(best.position.z - SKY.pos.z)) / DEG); const off = angDiff(SKY.hdg, brg);
    const want = Math.abs(off) < 35 && bd < 30000 ? (off >= 0 ? -1 : 1) * 25 : 0; tb = want;
  }
  return { pitch: (tp - SKY.pitch) / 4, roll: (tb - SKY.roll) / 25 };
}
function skyInstr() {
  const storms = SKY.storms.map(c => { const dx = c.position.x - SKY.pos.x, dz = c.position.z - SKY.pos.z;
    return { brg: wrapDeg(Math.atan2(dx, -dz) / DEG), dist: Math.hypot(dx, dz) / 1852, r: c.userData.radius / 1852, lvl: 3, rot: c.id % 3 }; });
  const T = SKY.traffic; const traffic = T ? [(() => { const dx = T.pos.x - SKY.pos.x, dz = T.pos.z - SKY.pos.z;
    return { brg: wrapDeg(Math.atan2(dx, -dz) / DEG), dist: Math.hypot(dx, dz) / 1852, rel: (T.pos.y - SKY.pos.y) / FT, trend: Math.sign(T.vs), level: T.level }; })()] : [];
  const ra = T && T.ra && !T.cpa ? T.raDir : null;
  const msgs = []; if (SKY.turb > .3) msgs.push({ t: 'TURBULENCE', c: COL.amber }); if (ra) msgs.push({ t: 'TCAS RA', c: COL.red }); else if (T && T.ta && !T.cpa) msgs.push({ t: 'TRAFFIC', c: COL.amber });
  if (SKY.belt) msgs.push({ t: 'SEATBELTS ON', c: '#fff' });
  const ias = 280 + Math.sin(RT.t * .7) * .8 - SKY.vs / 1000;
  return {
    pfd: { pitch: SKY.pitch, roll: SKY.roll, ias, mach: .85 + (ias - 280) / 600, alt: SKY.alt, vs: SKY.vs, hdg: SKY.hdg, selAlt: SKY.selAlt, selSpd: 280, selHdg: SKY.hdg,
      fd: fdFor(), ra, fma: ['SPD', 'HDG HOLD', Math.abs(SKY.selAlt - SKY.alt) < 100 ? 'ALT' : 'V/S'] },
    nd: { hdg: SKY.hdg, range: 40, storms, traffic, course: 90, wp: 'ASHER', gs: TAS * 1.944, tas: TAS * 1.944 },
    eicas: { n1: [86.4, 86.6, 86.2, 86.5], gear: 1, flaps: 0, fuel: 142.6 - RT.t * .01, msgs },
    mcp: { spd: 280, hdg: SKY.hdg, vs: Math.round(SKY.vs / 100) * 100, alt: SKY.selAlt },
  };
}

/* ── input: drag on the windshield = control stick, arrows/WASD too ── */
function bindSkyInput() {
  const sc = $('scene'), stick = $('stick'), knob = stick.querySelector('i'); let st = null;
  const isUI = el => el.closest('button, #mode, .corner-tools');
  sc.addEventListener('pointerdown', e => { if (GAME !== 'sky' || isUI(e.target) || $('end-ov').classList.contains('show')) return;
    st = { id: e.pointerId, x: e.clientX, y: e.clientY }; const r = sc.getBoundingClientRect();
    stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px'; stick.style.display = 'block'; knob.style.transform = '';
    $('stick-hint').classList.remove('show'); initA(); });
  addEventListener('pointermove', e => { if (!st || e.pointerId !== st.id) return; const dx = clamp((e.clientX - st.x) / 65, -1, 1), dy = clamp((e.clientY - st.y) / 65, -1, 1);
    SKY.stick.x = dx; SKY.stick.y = -dy; knob.style.transform = `translate(${dx * 46}px,${dy * 46}px)`; });
  const end = e => { if (!st || e.pointerId !== st.id) return; st = null; SKY.stick.x = SKY.stick.y = 0; stick.style.display = 'none'; };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  addEventListener('keydown', e => { if (GAME !== 'sky') return; SKY.keys[e.key] = true; if (e.key.startsWith('Arrow')) { e.preventDefault(); $('stick-hint').classList.remove('show'); } });
  addEventListener('keyup', e => { SKY.keys[e.key] = false; });
  tap($('sb-level'), () => { SKY.autoLevel = !SKY.autoLevel; $('sb-level').classList.toggle('on', SKY.autoLevel); sfx('success'); });
  tap($('sb-belt'), () => { SKY.belt = !SKY.belt; $('sb-belt').classList.toggle('on', SKY.belt); $('sb-belt').classList.remove('guide'); RT.plane.setBelt(SKY.belt); sfx('seatbelt_ding'); });
}
