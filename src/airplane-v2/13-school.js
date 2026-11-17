/* ═══ FLIGHT SCHOOL: six short voice-guided lessons for a little pilot ═══
   No reading and no failing: a wrong tap gets "try again", a stuck step starts to glow,
   and every finished lesson puts a sticker on the Pilot Wings board (saved in localStorage).
   Lessons are async scripts. Every helper is tied to FS.tok, so leaving a lesson simply
   orphans its promises (they never resolve) instead of letting it run on. */
const FS_LESSONS = [
  { emo: '🎛️', name: 'MEET THE COCKPIT', sub: 'Find the buttons' },
  { emo: '🌤️', name: 'BLUE SKY, BROWN GROUND', sub: 'Up, down, left, right' },
  { emo: '💨', name: 'FAST AND SLOW', sub: 'Thrust makes speed' },
  { emo: '🛞', name: 'WHEELS UP, WHEELS DOWN', sub: 'Landing gear' },
  { emo: '📻', name: 'TALK ON THE RADIO', sub: 'Hear our name, say ROGER' },
  { emo: '🚒', name: 'EMERGENCY HERO', sub: 'Practise MAYDAY' },
];
const FS = { tok: 0, sayN: 0, scene: null, want: null, waiters: [], step: null, sayRes: null, thrHeld: false, allowThr: false, hold78: false,
  prog: 0, pitch: 0, ias: 0, vs: 0, vspd: null, air: false, vx: 0, gs: 0, phase: '', fire: false, fireK: 0, e3: 1, e3fail: false, em: null, envK: 0, greeted: false, cur: 0 };
const FS_KEY = 'airplaneSchool';
const SI = k => 'school.instructor.' + k;
function fsBadges() { try { const b = JSON.parse(localStorage.getItem(FS_KEY) || '[]'); return Array.isArray(b) ? b : []; } catch (e) { return []; } }
function fsSaveBadge(n) { const b = fsBadges(); if (!b.includes(n)) { b.push(n); try { localStorage.setItem(FS_KEY, JSON.stringify(b)); } catch (e) {} } return b; }
function skyFlyable() { return GAME === 'sky' || (GAME === 'school' && FS.scene === 'sky'); }

/* ── promise helpers (all cancelled by FS.tok++) ── */
function fsWait(ms) { const tok = FS.tok; return new Promise(r => later(ms, () => tok === FS.tok && r())); }
function fsUntil(fn) { const tok = FS.tok; return new Promise(r => FS.waiters.push({ fn, r, tok })); }
// speak a line; a newer line interrupts it and lets the older promise go on
function fsSay(id) {
  const tok = FS.tok; FS.sayN++;
  return new Promise(res => {
    const prev = FS.sayRes; FS.sayRes = null; prev && prev();
    const fin = () => { if (FS.sayRes === fin) FS.sayRes = null; if (tok === FS.tok) res(); };
    FS.sayRes = fin; say(id, { cb: fin });
  });
}
// ATC call: any airline's callsign clip + a generic instruction clip
function fsRadio(al, lineId) {
  const tok = FS.tok; FS.sayN++;
  return new Promise(res => {
    const prev = FS.sayRes; FS.sayRes = null; prev && prev();
    const fin = () => { if (FS.sayRes === fin) FS.sayRes = null; if (tok === FS.tok) res(); };
    FS.sayRes = fin;
    const map = RENDER(), parts = [map.get(`${al.id}|atc.callsign`), map.get(`common|${lineId}`)].filter(Boolean);
    const text = parts.map(p => p.text).join(' '); subtitle('center', text); noisy(.12, .08, 2400);
    const seq = ++voiceSeq, done = () => { if (seq === voiceSeq) fin(); };
    if (muted) { setTimeout(done, Math.min(2600, 300 + text.length * 25)); return; }
    voiceEl.pause(); try { speechSynthesis.cancel(); } catch (e) {}
    playParts(parts, 0, SCRIPTS.voices.center || {}, seq, done);
  });
}
// wait for a tap on one of ids; wrong(id) is called for any other button
function fsExpect(ids, wrong) { const tok = FS.tok; return new Promise(res => { FS.want = { ids, wrong, res: id => tok === FS.tok && res(id) }; }); }
// repeat a reminder line while the same tap is still awaited
function fsRemind(line, every, glowId) {
  const w = FS.want, tok = FS.tok;
  const go = () => { if (tok !== FS.tok || FS.want !== w) return; if (glowId) fsGlow(glowId, true); fsSay(line); later(every, go); };
  later(every, go);
}
function fsGlow(id, on) { const el = $(id); if (!el) return; el.classList.toggle(el.classList.contains('korry') ? 'guide' : 'fs-glow', on); }
function fsFade(to) { const tok = FS.tok, el = $('whiteout'), from = +el.style.opacity || 0;
  return new Promise(r => tween(.9, k => el.style.opacity = lerp(from, to, k), () => tok === FS.tok && r())); }
function fsLamps(c) { ['lp-g1', 'lp-g2', 'lp-g3'].forEach(id => $(id).className = 'lamp' + (c ? ' ' + c : '')); }
function fsCard(n, pic, big = false) {
  const L = FS_LESSONS[n - 1]; $('fs-k').textContent = `LESSON ${n} · ${L.name}`;
  const p = $('fs-pic'); p.textContent = pic || L.emo; p.classList.toggle('word', !!big);
}
function fsDots(total, done) { $('fs-dots').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join(''); }
function fsHand(dir) { const h = $('fs-hand'); h.className = dir ? 'show ' + dir : ''; }
function fsPraise() { return fsSay(SI('praise_' + (1 + ((Math.random() * 3) | 0)))); }

/* ── taps: in school mode the panel buttons are routed here (capture phase) ── */
function fsBindCapture() {
  const root = $('scr-sim'), SEL = '.korry, #md-cover, #md-btn, #rotate-b, #fs-roger';
  const pick = e => GAME === 'school' && e.target && e.target.closest ? e.target.closest(SEL) : null;
  const down = e => { const el = pick(e); if (!el) return; e.stopPropagation(); if (e.cancelable) e.preventDefault(); initA(); fsPress(el.id, true); };
  const up = e => { const el = pick(e); if (!el) return; e.stopPropagation(); if (e.cancelable && e.type === 'touchend') e.preventDefault(); fsPress(el.id, false); };
  ['touchstart', 'mousedown'].forEach(t => root.addEventListener(t, down, { capture: true, passive: false }));
  ['touchend', 'touchcancel', 'mouseup', 'click'].forEach(t => root.addEventListener(t, up, { capture: true, passive: false }));
  addEventListener('mouseup', () => { if (FS.thrHeld) fsPress('k-thrust', false); });
  tap($('fs-back'), () => fsMenu()); tap($('fs-home'), backToMenu);
  tap($('fs-again'), () => fsGo(FS.cur)); tap($('fs-list'), () => fsMenu()); tap($('fs-next'), () => fsGo(FS.cur + 1));
}
function fsPress(id, down) {
  if (id === 'k-thrust') { FS.thrHeld = down; $('k-thrust').classList.toggle('held', down); }
  if (!down) return;
  if (id === 'fs-roger') tone(1500, .05, 'square', .08);
  const w = FS.want; if (!w) return;
  if (w.ids.includes(id)) { FS.want = null; w.res(id); } else if (w.wrong) w.wrong(id);
}

/* ── scenes ── */
function fsPanelScene(kind) {
  tkTeardown(); document.body.classList.remove('sky'); tkSetup(); RT.tick = fsTick; FS.scene = kind;
  const P = RT.plane, st = P.state;
  Object.assign(st, { flaps: 0, gear: 0, door: 0, n1: 0, beacon: true, strobes: false, landing: false, taxiLight: false, glow: 0, spoil: 0, ail: 0, elev: 0, rud: 0 });
  TK.flapsCmd = 0; TK.gearCmd = 0; Object.assign(FS, { pitch: 0, ias: 0, vs: 0, vspd: null, envK: 0, air: false, prog: 0, fire: false, fireK: 0, e3: 1, e3fail: false, em: null });
  TK.tug.visible = false; P.root.rotation.set(0, 0, 0);
  if (kind === 'gate') { P.root.position.set(GATE.x, 0, GATE.z); P.root.rotation.set(0, GATE.rotY, 0); st.door = 1; st.beacon = false; TK.bridge.set(1); }
  else { TK.bridge.set(0); RT.plane.root.position.copy(LINEUP); st.n1 = .25; st.strobes = st.landing = true; }
  if (kind === 'air') { st.gear = 1; TK.gearCmd = 1; st.n1 = .7; }
  setView('chase'); RT.autoOrbit = 0;
  mdUiReset(); $('guard').classList.add('lkd'); lockAll(); KEYS.forEach(id => $(id).classList.remove('lit', 'lit-a'));
  fsLamps(st.gear < .5 ? 'grn' : ''); $('kt-gear').textContent = st.gear < .5 ? 'DOWN' : 'UP';
  $('kt-flaps').textContent = 'UP'; $('fl-up').className = 'fl-cell lit'; $('fl-10').className = 'fl-cell'; $('fl-10').textContent = '10';
  $('kt-belt').textContent = 'ON'; $('lp-belt').className = 'lamp amb'; $('k-belt').classList.add('lit-a');
  ['hud-gate', 'hud-alt', 'hud-cmp', 'taxi-l'].forEach(id => hud(id, false));
}
function fsSkyScene() {
  tkTeardown(); skySetup(); FS.scene = 'sky';
  Object.assign(SKY, { alt: 35000, hdg: 90, pitch: 0, roll: 0, vs: 0, selAlt: 35000, assigned: 35000, stars: 0, idx: 0, ch: null, turb: 0, inStorm: false, belt: true, done: true, autoLevel: true });
  SKY.stick.x = SKY.stick.y = 0; $('sb-level').classList.add('on'); $('sb-belt').classList.add('on'); RT.plane.setBelt(true);
  SKY.pos.set(0, SKY.alt * FT, 0);
  Object.assign(RT.plane.state, { flaps: 0, gear: 1, door: 0, n1: .82, beacon: true, strobes: true, landing: false, taxiLight: false, glow: 0 }); TK.flapsCmd = 0;
  setView('pilot'); RT.pitchBias = 0; setEnv(.2, 3000, { fogNear: 8000, fogFar: 90000 }); resize();
  RT.tick = (dt, t) => { skyTick(dt, t); fsCommon(dt); };
}
function fsCommon(dt) {
  FS.step && FS.step(dt);
  if (FS.waiters.length) FS.waiters = FS.waiters.filter(w => { if (w.tok !== FS.tok) return false; if (w.fn()) { w.r(); return false; } return true; });
}
function fsTick(dt) {
  const P = RT.plane, st = P.state;
  st.flaps = damp(st.flaps, TK.flapsCmd, 1.4, dt);
  st.gear = clamp(st.gear + (TK.gearCmd - st.gear) * Math.min(1, dt * .9), 0, 1);
  fsCommon(dt);
  const y = P.root.position.y;
  setEnv(FS.envK, y);
  if (W.airport) W.airport.visible = y < 1200; RT.others.forEach(o => o.root.visible = y < 1200);
  if (TK.clouds) { const show = y > 300; TK.clouds.group.visible = TK.deck.group.visible = show;
    if (show) { TK.clouds.recycle(P.root.position, new THREE.Vector3(1, 0, 0)); TK.deck.follow(P.root.position); } }
  if (P.levers) { P.levers.forEach(l => l.rotation.z = -clamp(st.n1 - .25, 0, 1) * .9); P.flapLever.rotation.z = -st.flaps / 10 * .5; P.gearLever.rotation.z = TK.gearCmd ? .6 : -.2; }
  const cabinOn = RT.view === 'cabin';
  P.cabinLight.intensity = P.cabinLight2.intensity = cabinOn ? 12 : 0; P.cockpitLight.intensity = RT.view === 'cockpit' ? 6 : 0;
  FS.fireK = damp(FS.fireK, FS.fire ? 1 : 0, FS.fire ? 1.5 : 1.2, dt); if (FS.em) FS.em.forEach(e => e.k = FS.fireK);
  if (FS.e3fail) FS.e3 = damp(FS.e3, 0, .7, dt);
  fxTick(dt);
  RT.instrT -= dt; if (RT.instrT <= 0) { RT.instrT = .08;
    panelInstr(fsInstr(), engData(st.n1, { out: [false, false, FS.e3fail, false], spool: FS.e3 * st.n1 * 100, fire: [false, false, FS.fireK > .3, false],
      msg: FS.fire ? 'FIRE ENG 3' : FS.e3fail ? 'ENG 3 SHUTDOWN' : st.n1 > .05 ? '' : 'ENG OFF', msgCol: FS.fire ? COL.red : COL.amber })); }
  engineSet(st.n1);
}
function fsInstr() {
  const P = RT.plane, y = P.root.position.y, ias = FS.ias, hdg = wrapDeg(AL.hdg - P.root.rotation.y / DEG), n1 = P.state.n1 * 100;
  return {
    pfd: { pitch: FS.pitch, roll: 0, ias, mach: ias / 660, alt: y * 3.28, vs: FS.vs, hdg, selAlt: y > 1000 ? 5000 : 3000, selSpd: y > 1000 ? 290 : 160,
      selHdg: AL.hdg, fma: ['SPD', 'HDG', y > 5 ? 'ALT' : 'TO/GA'], vspd: FS.vspd },
    nd: { hdg, range: 10, course: AL.hdg, wp: 'RW' + AL.rwy, gs: ias, tas: ias, storms: [], traffic: [] },
    eicas: { n1: [n1, n1, n1, n1], gear: P.state.gear, flaps: P.state.flaps, msgs: [] },
    mcp: { spd: 160, hdg: AL.hdg, vs: '----', alt: 3000 },
  };
}

/* ── menu / reset / complete ── */
function fsReset() {
  clearTimers(); cancelVoice(); FS.tok++;
  Object.assign(FS, { want: null, waiters: [], step: null, sayRes: null, thrHeld: false, allowThr: false, hold78: false, fire: false, em: null, e3fail: false });
  ['fs-done', 'fs-roger'].forEach(id => $(id).classList.remove('show')); fsHand(null);
  $('spd-wrap').classList.remove('show'); $('rotate-b').classList.remove('show', 'late'); $('stick-hint').classList.remove('show');
  $('spd-fill').style.width = '0%'; $('tf').style.width = '0%'; $('k-thrust').classList.remove('held');
  RT.autoOrbit = 0; RT.shake = 0; $('whiteout').style.opacity = 0; document.body.classList.remove('fs-pfd');
  if (FS.scene === 'sky') skyTeardown(); else if (FS.scene) tkTeardown();
  FS.scene = null; mdUiReset();
}
function fsTeardown() { fsReset(); document.body.classList.remove('school'); $('fs-menu').classList.remove('show'); }
function fsStart() { document.body.classList.add('school'); fsMenu(); }
function fsWingsSVG(gold) {
  const c = gold ? '#ffcf3a' : 'rgba(255,255,255,.28)', w = 'M100 20 C78 10 38 8 4 14 C28 19 50 22 70 26 C48 26 30 28 12 33 C36 35 56 35 74 36 C58 39 44 43 30 48 C54 48 76 45 92 41 Z';
  return `<svg viewBox="0 0 200 60" aria-hidden="true"><g fill="${c}"><path d="${w}"/><path d="${w}" transform="translate(200 0) scale(-1 1)"/>` +
    `<circle cx="100" cy="30" r="15"/></g><text x="100" y="36" text-anchor="middle" font-size="17">✈️</text></svg>`;
}
function fsBoard(el) {
  const b = fsBadges();
  el.innerHTML = `<div class="fs-wings${b.length === 6 ? ' gold' : ''}">${fsWingsSVG(b.length === 6)}</div><div class="fs-slots">` +
    FS_LESSONS.map((L, i) => `<span class="${b.includes(i + 1) ? 'got' : ''}">${b.includes(i + 1) ? L.emo : i + 1}</span>`).join('') + '</div>';
}
function fsMenu() {
  fsReset(); document.body.classList.add('school');
  fsPanelScene('gate'); setPreset({ az: -125, el: 16, dist: 120 }, true); RT.autoOrbit = 5;
  const b = fsBadges(), g = $('fs-tiles'); g.innerHTML = '';
  FS_LESSONS.forEach((L, i) => {
    const t = document.createElement('button'); t.className = 'fs-tile' + (b.includes(i + 1) ? ' got' : '');
    t.innerHTML = `<span class="fs-n">${i + 1}</span><span class="fs-e">${L.emo}</span><b>${L.name}</b><small>${L.sub}</small>`;
    tap(t, () => { initA(); fsGo(i + 1); }); g.appendChild(t);
  });
  fsBoard($('fs-board')); $('fs-menu').classList.add('show');
  if (!FS.greeted) { FS.greeted = true; later(500, () => fsSay(SI('welcome'))); }
}
function fsGo(n) {
  if (n < 1 || n > 6) return fsMenu();
  fsReset(); document.body.classList.add('school'); $('fs-menu').classList.remove('show'); FS.cur = n; fsDots(0, 0);
  [fsL1, fsL2, fsL3, fsL4, fsL5, fsL6][n - 1]();
}
function fsComplete(n) {
  const before = fsBadges().length, b = fsSaveBadge(n), wings = b.length === 6 && before < 6;
  lockAll(); $('guard').classList.add('lkd'); $('fs-roger').classList.remove('show'); fsHand(null);
  later(700, () => {
    sfx('success_big'); later(400, () => sfx('cruise_jingle'));
    $('fs-st').textContent = FS_LESSONS[n - 1].emo; $('fs-dt').textContent = wings ? 'PILOT WINGS!' : 'STICKER!';
    $('fs-dn').textContent = FS_LESSONS[n - 1].name; $('fs-next').style.display = n < 6 ? '' : 'none';
    $('fs-done').classList.toggle('wings', wings); fsBoard($('fs-dboard')); $('fs-done').classList.add('show');
    fsSay(SI('sticker')).then(() => { if (wings) fsSay(SI('wings')); });
  });
}

/* ── LESSON 1: Meet the Cockpit — find the button the voice names ── */
const L1_BTNS = [['k-flaps', 'flaps', 'FLAPS'], ['k-belt', 'belt', 'SEAT BELT'], ['k-thrust', 'thrust', 'THRUST'],
  ['k-ann', 'pa', 'CABIN PA'], ['k-gear', 'gear', 'LDG GEAR'], ['k-push', 'push', 'PUSH BACK']];
async function fsL1() {
  fsPanelScene('gate'); setPreset({ az: -125, el: 14, dist: 95 }, true);
  unlock(...KEYS); fsCard(1); fsDots(6, 0);
  await fsWait(500); await fsSay(SI('l1_intro'));
  for (let i = 0; i < L1_BTNS.length; i++) {
    const [id, k, label] = L1_BTNS[i]; fsDots(6, i); fsCard(1, label, true);
    let wrongs = 0, w = null;
    const p = fsExpect([id], wid => {
      const x = L1_BTNS.find(b => b[0] === wid); fb('TRY AGAIN', 'wait'); if (++wrongs >= 2) fsGlow(id, true);
      if (!x) return; fsSay(SI('l1_that_' + x[1])); const n = FS.sayN;
      fsUntil(() => FS.sayRes === null).then(() => { if (FS.want === w && FS.sayN === n) fsSay(SI('l1_find_' + k)); });
    });
    w = FS.want;
    fsSay(SI('l1_find_' + k));
    later(10000, function hint() { if (FS.want === w) { fsGlow(id, true); fsSay(SI('hint_glow')); later(12000, hint); } });
    await p; fsGlow(id, false); fb('YES!', 'ok'); fsL1Effect(k);
    await fsSay(SI('l1_did_' + k)); await fsWait(500);
  }
  fsDots(6, 6); await fsSay(SI('l1_done')); fsComplete(1);
}
function fsL1Effect(k) {
  const P = RT.plane, st = P.state;
  if (k === 'flaps') { TK.flapsCmd = 10; sfx('flaps_motion'); $('kt-flaps').textContent = '10'; $('k-flaps').classList.add('lit');
    $('fl-up').className = 'fl-cell'; $('fl-10').className = 'fl-cell lit'; setPreset({ az: 120, el: 25, dist: 70 }); }
  if (k === 'belt') { sfx('seatbelt_ding'); later(500, () => sfx('seatbelt_ding')); P.setBelt && P.setBelt(true); setPreset({ az: -125, el: 14, dist: 95 }); }
  if (k === 'thrust') { sfx('engine_start'); setPreset({ az: 60, el: 6, dist: 62 }); tween(1.5, q => st.n1 = q * .45, () => later(2600, () => tween(2, q => st.n1 = .45 * (1 - q)))); }
  if (k === 'pa') { sfx('pa_chime'); $('k-ann').classList.add('lit'); }
  if (k === 'gear') { sfx('gear_motion'); fsLamps('amb'); later(1600, () => fsLamps('grn')); setPreset({ az: -95, el: -6, dist: 70 }); }
  if (k === 'push') { [0, 700, 1400].forEach(t => later(t, () => sfx('pushback_beep', .6))); setPreset({ az: 95, el: 30, dist: 110 }); }
}

/* ── LESSON 2: Blue Sky, Brown Ground — drag on the window: up, down, left, right, level ── */
async function fsL2() {
  fsSkyScene(); document.body.classList.add('fs-pfd'); fsCard(2, '🟦🟫'); fsDots(5, 0);
  await fsWait(700); await fsSay(SI('l2_intro')); document.body.classList.remove('fs-pfd');
  const steps = [['up', '⬆️', () => SKY.pitch > 3.5], ['down', '⬇️', () => SKY.pitch < -3.5], ['left', '⬅️', () => SKY.roll < -14], ['right', '➡️', () => SKY.roll > 14]];
  for (let i = 0; i < steps.length; i++) {
    const [d, pic, ok] = steps[i]; fsDots(5, i); fsCard(2, pic); fsHand(d); fsSay(SI('l2_' + d));
    let t0 = RT.t; await fsUntil(() => { if (RT.t - t0 > 14) { t0 = RT.t; fsSay(SI('l2_' + d)); } return ok(); });
    fsHand(null); fb('YES!', 'ok'); await fsSay(SI('l2_' + d + '_ok'));
  }
  fsDots(5, 4); fsCard(2, '➖'); fsSay(SI('l2_level'));
  let held = 0, last = RT.t, t0 = RT.t;
  await fsUntil(() => { const dt = RT.t - last; last = RT.t;
    const ok = Math.abs(SKY.pitch) < 1.2 && Math.abs(SKY.roll) < 3 && !SKY.stick.x && !SKY.stick.y; held = ok ? held + dt : 0;
    if (RT.t - t0 > 14) { t0 = RT.t; fsSay(SI('l2_level')); } return held > 1.2; });
  fsDots(5, 5); fb('LEVEL!', 'ok'); await fsSay(SI('l2_done')); fsComplete(2);
}

/* ── LESSON 3: Fast and Slow — hold THRUST to the green, let go to stop; third time ROTATE ── */
async function fsL3() {
  fsPanelScene('runway'); setPreset({ az: -165, el: 9, dist: 72 }, true);
  const P = RT.plane, st = P.state; FS.vspd = VSPD; FS.allowThr = true;
  unlock('k-thrust'); fsGlow('k-thrust', true); $('spd-wrap').classList.add('show'); fsCard(3, '💨'); fsDots(3, 0);
  FS.step = dt => {
    if (!FS.air) {
      const push = FS.thrHeld && FS.allowThr;
      FS.prog = push ? Math.min(100, FS.prog + 100 / 4.2 * dt) : Math.max(FS.hold78 ? 80 : 0, FS.prog - 16 * dt);
      P.root.position.x += FS.prog * .85 * dt; FS.ias = FS.prog * KT_PER;
      st.n1 = damp(st.n1, push || FS.hold78 ? .3 + FS.prog / 100 * .68 : .25, 2.5, dt); RT.shake = FS.prog / 100 * .5;
      $('spd-fill').style.width = FS.prog + '%'; $('tf').style.width = FS.prog + '%'; $('spd-kt').textContent = Math.round(FS.ias);
    } else {
      FS.pitch = damp(FS.pitch, 10, 1.2, dt); P.root.rotation.z = FS.pitch * DEG; FS.vx = damp(FS.vx, 85, .8, dt); P.root.position.x += FS.vx * dt;
      if (FS.pitch > 6) P.root.position.y = Math.min(400, P.root.position.y + 9 * dt);
      FS.ias = Math.min(180, FS.ias + 5 * dt); FS.vs = 1700; RT.shake = Math.max(0, RT.shake - dt); st.n1 = damp(st.n1, .95, 2, dt);
    }
  };
  await fsSay(SI('l3_intro'));
  for (let r = 0; r < 3; r++) {
    fsDots(3, r);
    if (r) { fsGlow('k-thrust', true); await fsSay(SI(r === 2 ? 'l3_fly' : 'l3_again')); }
    let nag = RT.t, idle = RT.t;
    await fsUntil(() => {
      if (FS.thrHeld) idle = RT.t;
      if (!FS.thrHeld && FS.prog > 6 && FS.prog < 70 && RT.t - nag > 4) { nag = RT.t; fsSay(SI('l3_hold')); }
      if (!FS.thrHeld && FS.prog < 1 && RT.t - idle > 12) { idle = RT.t; fsSay(SI('l3_intro')); }
      return FS.prog >= 78; });
    fsGlow('k-thrust', false);
    if (r < 2) {
      fb('GREEN!', 'ok'); sfx('rotate_cue'); fsSay(SI('l3_green'));
      let nag2 = RT.t;
      await fsUntil(() => { if (FS.thrHeld && RT.t - nag2 > 5) { nag2 = RT.t; fsSay(SI('l3_letgo')); } return !FS.thrHeld && FS.prog <= .5; });
      fb('STOP', 'ok'); await fsSay(SI('l3_stop'));
    } else {
      FS.hold78 = true; FS.allowThr = false; $('rotate-b').classList.add('show'); sfx('rotate_cue');
      const p = fsExpect(['rotate-b']); fsSay(SI('l3_rotate')); fsRemind(SI('l3_rotate'), 8000);
      await p;
      $('rotate-b').classList.remove('show'); $('spd-wrap').classList.remove('show'); $('tf').style.width = '0%';
      FS.air = true; FS.vx = FS.prog * .85; FS.vspd = null; fsDots(3, 3);
      fb('UP!', 'ok'); sfx('success_big'); setPreset({ az: -110, el: -6, dist: 80 });
      await fsWait(3200); await fsSay(SI('l3_done')); fsComplete(3);
    }
  }
}

/* ── LESSON 4: Wheels Up, Wheels Down — gear up after takeoff, gear down on approach, auto landing ── */
async function fsL4() {
  fsPanelScene('air'); const P = RT.plane, st = P.state;
  st.gear = 0; TK.gearCmd = 0; fsLamps('grn'); $('kt-gear').textContent = 'DOWN'; $('k-gear').classList.add('lit');
  TK.flapsCmd = 10; st.flaps = 10; st.n1 = .95; st.landing = true;
  P.root.position.set(900, 60, 0); Object.assign(FS, { pitch: 8, ias: 175, vs: 1500 });
  setPreset({ az: -110, el: -4, dist: 85 }, true);
  FS.step = dt => { const y = P.root.position.y; P.root.position.x += 78 * dt;
    if (y < 420) P.root.position.y = y + 7 * dt; FS.vs = y < 420 ? 1400 : 0; FS.pitch = damp(FS.pitch, y < 420 ? 8 : 2, 1, dt); P.root.rotation.z = FS.pitch * DEG; };
  fsCard(4, '🛞⬆️'); fsDots(2, 0); unlock('k-gear'); fsGlow('k-gear', true);
  let p = fsExpect(['k-gear'], () => fsSay(SI('not_now'))); fsSay(SI('l4_intro')); fsRemind(SI('l4_remind_up'), 10000, 'k-gear');
  await p;
  fsGlow('k-gear', false); lockAll(); TK.gearCmd = 1; sfx('gear_motion'); fsLamps('amb'); later(2600, () => fsLamps(''));
  $('kt-gear').textContent = 'UP'; $('k-gear').classList.remove('lit'); fb('WHEELS UP', 'ok'); setPreset({ az: -95, el: -10, dist: 70 });
  fsDots(2, 1); await fsSay(SI('l4_up_ok')); await fsWait(1200); await fsSay(SI('l4_turn'));
  await fsFade(1);
  // final approach on a 3° glide path to the touchdown zone
  const G = .0524; let x0 = -2500; P.root.position.set(x0, (TD_X - x0) * G, 0); st.gear = 1; TK.gearCmd = 1; TK.flapsCmd = 15; st.flaps = 15; st.n1 = .55;
  Object.assign(FS, { pitch: 2.5, gs: 72, phase: 'app', vs: -750 }); P.root.rotation.z = FS.pitch * DEG; FS.cam60 = 0;
  setPreset({ az: -150, el: 10, dist: 95 }, true);
  FS.step = dt => {
    if (FS.phase === 'app') {
      const y = P.root.position.y, vs = y > 12 ? FS.gs * G : Math.min(FS.gs * G, Math.max(.5, y / 2.5));
      P.root.position.y = Math.max(0, y - vs * dt); P.root.position.x += FS.gs * dt; FS.vs = -vs * 196.85;
      FS.pitch = damp(FS.pitch, y < 12 ? 5.5 : 2.5, 1.2, dt);
      if (y < 60 && !FS.cam60) { FS.cam60 = 1; setPreset({ az: -140, el: 4, dist: 78 }); }
      if (P.root.position.y <= 0) { FS.phase = 'roll'; sfx('touchdown'); RT.shake = .4; st.spoil = 1; st.n1 = .3; FS.vs = 0;
        for (const z of [-5.5, 5.5]) fxEmit('steam', P.root.position.clone().add(new THREE.Vector3(-4, .5, z)), 6);
        setPreset({ az: -165, el: 8, dist: 85 }); fsSay(SI('l4_done')); }
    } else if (FS.phase === 'roll') {
      FS.pitch = damp(FS.pitch, 0, 1.6, dt); FS.gs = Math.max(0, FS.gs - 2.8 * dt); P.root.position.x += FS.gs * dt; RT.shake = Math.max(0, RT.shake - dt);
      if (FS.gs < .3) { FS.phase = 'stop'; st.spoil = 0; RT.autoOrbit = 6; }
    }
    P.root.rotation.z = FS.pitch * DEG; FS.ias = FS.gs * 1.944;
  };
  await fsFade(0);
  fsCard(4, '🛞⬇️'); unlock('k-gear'); fsGlow('k-gear', true);
  p = fsExpect(['k-gear'], () => fsSay(SI('not_now'))); fsSay(SI('l4_down')); fsRemind(SI('l4_remind_down'), 9000, 'k-gear');
  const r = await Promise.race([p, fsUntil(() => P.root.position.y < 140).then(() => 'help')]);
  FS.want = null; fsGlow('k-gear', false); lockAll();
  TK.gearCmd = 0; sfx('gear_motion'); fsLamps('amb'); later(2600, () => fsLamps('grn'));
  $('kt-gear').textContent = 'DOWN'; $('k-gear').classList.add('lit'); fb('WHEELS DOWN', 'ok'); setPreset({ az: -95, el: -8, dist: 70 });
  fsDots(2, 2); await fsSay(SI(r === 'help' ? 'l4_help' : 'l4_down_ok'));
  later(4000, () => { if (FS.phase === 'app' && !FS.cam60) setPreset({ az: -150, el: 8, dist: 90 }); });
  await fsUntil(() => FS.phase === 'stop'); await fsWait(1500); fsComplete(4);
}

/* ── LESSON 5: Talk on the Radio — tap ROGER only when ATC calls OUR plane ── */
async function fsL5() {
  fsSkyScene(); fsCard(5, '📻'); fsDots(6, 0); $('fs-roger').classList.add('show');
  await fsWait(800); await fsSay(SI('l5_intro')); await fsSay(SI('l5_rule'));
  const others = AIRLINES.filter(a => a.id !== AL.id), off = (Math.random() * others.length) | 0;
  const plan = [1, 0, 1, 0, 0, 1], calls = ['call_a', 'call_b', 'call_c', 'call_d', 'call_e', 'call_b'];
  for (let i = 0; i < plan.length; i++) {
    fsDots(6, i); await fsWait(1400);
    const us = plan[i], al = us ? AL : others[(off + i * 3) % others.length];
    const p = fsExpect(['fs-roger']);
    const callP = fsRadio(al, 'school.center.' + calls[i]);
    const r = await Promise.race([p, callP.then(() => fsWait(us ? 5500 : 4000)).then(() => null)]);
    if (r) await callP;
    if (us) {
      if (!r) { fsGlow('fs-roger', true); fsSay(SI('l5_was_us')); fsRemind(SI('l5_was_us'), 9000); await p; }
      FS.want = null; fsGlow('fs-roger', false); fb('ROGER!', 'ok');
      await fsSay('school.captain.roger'); await fsSay(SI('l5_yes'));
    } else {
      FS.want = null;
      if (r) { fb('NOT US', 'wait'); await fsSay(SI('l5_not_us')); } else { fb('GOOD!', 'ok'); await fsSay(SI('l5_good_skip')); }
    }
  }
  fsDots(6, 6); await fsSay(SI('l5_done')); fsComplete(5);
}

/* ── LESSON 6: Emergency Hero — cover, MAYDAY, pull the fire handle, no crash ── */
async function fsL6() {
  fsPanelScene('air'); const P = RT.plane, st = P.state;
  P.root.position.set(0, 1400, 0); Object.assign(FS, { envK: .1, ias: 290, pitch: 2 }); P.root.rotation.z = 2 * DEG; st.n1 = .8;
  FS.step = dt => { P.root.position.x += 140 * dt; };
  setPreset({ az: -40, el: 12, dist: 110 }, true);
  const g = $('guard'); g.classList.remove('lkd'); fsCard(6, '🟨⬛'); fsDots(3, 0);
  await fsWait(600); await fsSay(SI('l6_intro'));
  g.classList.add('fs-hint');
  let p = fsExpect(['md-cover']); fsSay(SI('l6_cover')); fsRemind(SI('l6_cover'), 10000);
  await p;
  g.classList.remove('fs-hint'); g.classList.add('open', 'active'); sfx('cover_click'); $('md-hint').textContent = 'PRESS!'; fsDots(3, 1); fsCard(6, '🟥');
  p = fsExpect(['md-btn']); fsSay(SI('l6_press')); fsRemind(SI('l6_press'), 10000);
  await p;
  g.classList.remove('active'); FS.fire = true; FS.e3fail = true; mdUiFire(); fsDots(3, 2); fsCard(6, '🔥');
  sfx('fire_bell'); const bell = () => { if (FS.fire) { sfx('fire_bell'); later(4000, bell); } }; later(4000, bell);
  FS.em = engineFireFx(); setPreset({ az: 70, el: 6, dist: 75 });
  await fsSay('landing.captain.mayday_call');
  p = fsExpect(['md-btn']); fsSay(SI('l6_fire')); fsRemind(SI('l6_fire'), 10000);
  await p;
  FS.fire = false; sfx('extinguisher'); mdUiOut(); fsDots(3, 3); fsCard(6, '🧯'); fb('FIRE OUT', 'ok');
  await fsSay(SI('l6_out')); await fsSay(SI('l6_done')); fsComplete(6);
}
