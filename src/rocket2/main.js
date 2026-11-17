// rocket2.html — mission logic, cameras, control panel, questions, narration, sound
import * as THREE from 'three';
import { buildVehicle, K } from './vehicle.js';
import { buildSite, ROCKET_BASE, PAD_Y, rampY } from './site.js';
import { makeSky, makeStars, makeEarth, makeLowClouds, Smoke, makeFlame, makeEntryGlow, R_EARTH } from './fx.js';
import { clamp, lerp, smooth, ease, DEG, TAU, disposeTree } from './util.js';

const $ = id => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const CANCEL = Symbol('cancel');
const C_EARTH = V3(0, -R_EARTH, 0);
const LABEL = { roll: 'Roll', fuel: 'Fuel', hatch: 'Hatch', ignite: 'Ignite', launch: 'Launch', boost: 'Boosters', tower: 'Tower', stage: 'Stage', home: 'Home', chute: 'Chute' };

// ───────────────────────── renderer / scene ─────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 2, .5, 3e7);
scene.add(camera);
scene.fog = new THREE.FogExp2(0xbfdcf5, 4.8e-5);
{
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 32);
  gr.addColorStop(0, '#6ea6f0'); gr.addColorStop(.48, '#dcecff'); gr.addColorStop(.52, '#8f8b7c'); gr.addColorStop(1, '#5d5a4e');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 32);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(t).texture; scene.environmentIntensity = .55;
  t.dispose(); pm.dispose();
}
const SUN_DIR = V3(.5, .62, .6).normalize();
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x6f6a5a, .9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 3.1); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = .35;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 1500;
let shadowHalf = 0;
function setShadowHalf(h) {
  if (h === shadowHalf) return; shadowHalf = h;
  const c = sun.shadow.camera; c.left = -h; c.right = h; c.top = h; c.bottom = -h; c.updateProjectionMatrix();
}
setShadowHalf(160);

const sky = makeSky(), stars = makeStars(), earth = makeEarth(), smoke = new Smoke(2000);
earth.group.position.copy(C_EARTH);
scene.add(sky.mesh, stars.mesh, earth.group, smoke.mesh);
const site = buildSite();
scene.add(site.group);
site.group.add(makeLowClouds());
const relFrame = new THREE.Group(); scene.add(relFrame);      // follows the rocket; holds dropped pieces

// ───────────────────────── audio + speech ─────────────────────────
const A = {
  ctx: null, muted: localStorage.getItem('rocket2Muted') === '1',
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(c.destination);
      const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      const chain = (type, f) => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return { fl, g }; };
      this.rum = chain('lowpass', 120); this.wind = chain('bandpass', 600);
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setRumble(v, f) { if (!this.ctx) return; const t = this.ctx.currentTime; this.rum.g.gain.setTargetAtTime(v, t, .12); this.rum.fl.frequency.setTargetAtTime(f, t, .2); },
  setWind(v) { if (!this.ctx) return; this.wind.g.gain.setTargetAtTime(v, this.ctx.currentTime, .3); },
  tone(f, dur, type = 'sine', vol = .2, del = 0) {
    if (!this.ctx) return;
    try {
      const c = this.ctx, t = c.currentTime + del, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .05);
    } catch (e) { /* ignore */ }
  },
  burst(dur = .5, f = 500, vol = .5) {
    if (!this.ctx) return;
    try {
      const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; fl.type = 'lowpass'; fl.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + .05);
    } catch (e) { /* ignore */ }
  },
  click() { this.tone(1700, .035, 'square', .09); },
  buzz() { this.tone(140, .22, 'sawtooth', .16); },
  beep() { this.tone(990, .13, 'sine', .22); },
  alarm() { for (let i = 0; i < 3; i++) this.tone(i % 2 ? 660 : 880, .15, 'square', .11, i * .19); },
  chime() { [523, 659, 784].forEach((f, i) => this.tone(f, .24, 'triangle', .2, i * .11)); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, .3, 'triangle', .22, i * .16)); },
  setMuted(m) {
    this.muted = m; localStorage.setItem('rocket2Muted', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 1;
    if (m) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    $('btnSound').textContent = m ? '🔇' : '🔊'; $('btnSound').setAttribute('aria-pressed', m ? 'true' : 'false');
  },
};
let voice = null, utter = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /Samantha/i.test(v.name) && /en[-_]US/i.test(v.lang)) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  } catch (e) { voice = null; }
}
if ('speechSynthesis' in window) { pickVoice(); try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { /* ignore */ } }
/** speak; resolves when finished (or after a safe time-out, so a stuck voice never blocks the game) */
function say(text) {
  return new Promise(res => {
    const est = 700 + text.length * 80;
    if (A.muted || !('speechSynthesis' in window)) { setTimeout(res, Math.min(est, 2000)); return; }
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    try {
      speechSynthesis.cancel(); speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; if (voice) u.voice = voice; u.rate = .9; u.pitch = 1.05;
      u.onend = fin; u.onerror = fin; utter = u;
      speechSynthesis.speak(u);
      setTimeout(fin, est + 2500);
    } catch (e) { fin(); }
  });
}
let lastHint = 0;
function hint(text) { const n = performance.now(); if (n - lastHint > 2600) { lastHint = n; say(text); } }

// ───────────────────────── game state ─────────────────────────
let PARTS = [], QUESTIONS = [];
let V = null, FX = null, craft = null;
let G = null;
const debris = [];
const keep = { level: 'easy', trips: Math.max(0, Number(localStorage.getItem('rocket2Trips')) || 0), parts: false, cut: false };
function freshG() {
  return {
    phase: 'pad', pt: 0, alt: 0, theta: 0, pitch: 0, roll: 0, rate: 1, met: 0, speed: 0,
    fuel: 0, fueling: false, hatchClosed: false, crewArmP: 0, armP: 0, armGo: false,
    rs: 0, rsT: 0, srbOn: false, srb: 0, rl10: 0, aj10: 0, lasFire: 0, glow: 0,
    att: { srb: true, las: true, fair: true, core: true, icps: true, sm: true },
    mlZ: 430, crawlerZ: 430, lift: .6, rolling: false, lowering: false, crawlerLeaving: false, rollDone: false,
    deploy: 0, deployGo: false, count: null, focusY: 50, desc: null, splashT: -1, shake: 0, escaped: false,
  };
}

function mountVehicle() {
  V = buildVehicle();
  const fl = (parent, kind, r0, r1, len, x, y, z) => { const f = makeFlame(kind, r0, r1, len); f.position.set(x, y, z); parent.add(f); return f; };
  FX = {
    srb: V.srbs.map(b => fl(b, 'srb', 1.75, 5.4, 74, 0, K.SRB_NOZZLE_Y, 0)),
    rs: K.RS25.map(([x, z]) => fl(V.core, 'rs25', 1.08, 1.7, 24, x, .1, z)),
    rl10: fl(V.icps, 'rl10', .95, 1.7, 10, 0, K.RL10_Y, 0),
    aj10: fl(V.sm, 'rl10', .55, 1.1, 6, 0, K.AJ10_Y, 0),
    las: [45, 135, 225, 315].map(a => { const f = fl(V.las, 'srb', .28, 1.2, 14, .62 * Math.sin(a * DEG), 89.6, .62 * Math.cos(a * DEG)); f.rotation.set(Math.cos(a * DEG) * -.42, 0, Math.sin(a * DEG) * .42); return f; }),
    glow: makeEntryGlow(),
    light: new THREE.PointLight(0xffb070, 0, 0, 2),
  };
  FX.glow.position.set(0, 83.1, 0); V.cm.add(FX.glow);
  FX.light.position.set(0, -14, 0); V.rocket.add(FX.light);
  V.rocket.position.set(0, ROCKET_BASE, 0); V.rocket.quaternion.identity();
  site.ml.add(V.rocket);
  craft = V.rocket;
  V.setCut(keep.cut);
}
function unmountVehicle() {
  if (!V) return;
  for (const d of debris) { d.o.removeFromParent(); disposeTree(d.o); }
  debris.length = 0;
  for (const o of [V.rocket, craft]) { if (o) { o.removeFromParent(); disposeTree(o); } }
  V = null; FX = null; craft = null;
}

// ───────────────────────── cancellable waiting ─────────────────────────
const pending = new Set();          // objects with rej()
const timers = [];                  // {t, res}  game-time waits
const conds = [];                   // {fn, res}
const tweens = [];                  // {t, dur, fn, res}
let epoch = 0;
function reg(o) { pending.add(o); return o; }
function cancelAll() {
  epoch++;
  for (const o of pending) o.rej(CANCEL);
  pending.clear(); timers.length = 0; conds.length = 0; tweens.length = 0;
  if (expect) setBtn(expect.id, ''); expect = null;
  question = null; $('yn').classList.add('hide'); $('yn').classList.remove('nag'); $('crt').classList.remove('ask');
  cw('alarm', '');
}
const wait = s => new Promise((res, rej) => { const o = reg({ t: s, rej }); o.res = () => { pending.delete(o); res(); }; timers.push(o); });
const until = fn => new Promise((res, rej) => { const o = reg({ fn, rej }); o.res = () => { pending.delete(o); res(); }; conds.push(o); });
const tween = (dur, fn) => new Promise((res, rej) => { const o = reg({ t: 0, dur, fn, rej }); o.res = () => { pending.delete(o); res(); }; tweens.push(o); });
async function tell(text) { const e = epoch; await say(text); if (e !== epoch) throw CANCEL; }
function tickWaits(dt) {
  for (let i = timers.length - 1; i >= 0; i--) { const o = timers[i]; o.t -= dt; if (o.t <= 0) { timers.splice(i, 1); o.res(); } }
  for (let i = conds.length - 1; i >= 0; i--) { const o = conds[i]; if (o.fn()) { conds.splice(i, 1); o.res(); } }
  for (let i = tweens.length - 1; i >= 0; i--) { const o = tweens[i]; o.t += dt; const k = Math.min(1, o.t / o.dur); o.fn(k); if (k >= 1) { tweens.splice(i, 1); o.res(); } }
}

// ───────────────────────── panel UI ─────────────────────────
const BTN = {}; document.querySelectorAll('[data-b]').forEach(b => { BTN[b.dataset.b] = b; });
function setBtn(id, st) { const b = BTN[id]; b.classList.remove('ready', 'done', 'late'); if (st) b.classList.add(st); }
function cw(id, st) { document.querySelector(`[data-cw="${id}"]`).className = 'cw' + (st ? ' ' + st : ''); }
function crt(phase, msg) { if (phase != null) $('crtPhase').textContent = phase; if (msg != null) $('crtMsg').textContent = msg; }
function gauge(f) { $('gNeedle').setAttribute('transform', `rotate(${-120 + 240 * clamp(f, 0, 1)} 50 50)`); }
function big(txt) { const b = $('big'); if (txt) { b.textContent = txt; b.classList.add('on'); } else b.classList.remove('on'); }
function fade(on, color = '#fff') { const f = $('fade'); f.style.background = color; f.style.opacity = on ? 1 : 0; }
function flashWrong(el) { el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 520); }
{
  const g = $('gTicks'); let s = '';
  for (let i = 0; i <= 8; i++) { const a = (-120 + i * 30 - 90) * DEG; s += `<line x1="${50 + 34 * Math.cos(a)}" y1="${50 + 34 * Math.sin(a)}" x2="${50 + 41 * Math.cos(a)}" y2="${50 + 41 * Math.sin(a)}"/>`; }
  g.innerHTML = s;
}

let expect = null;     // the button the mission is waiting for
let question = null;   // the yes/no question being asked
function step(id, prompt, o = {}) {
  return new Promise((res, rej) => {
    expect = reg({ id, t: 0, late: false, nag: 0, res, rej, ...o });
    setBtn(id, 'ready'); crt(null, prompt); say(prompt);
  });
}
function resolveStep(how) {
  const e = expect; expect = null; pending.delete(e);
  setBtn(e.id, 'done'); cw('alarm', ''); e.res(how);
}
function onPress(id) {
  A.resume(); A.click();
  if (!G || $('start').hidden === false) return;
  if (question) { flashWrong(BTN[id]); A.buzz(); $('yn').classList.add('nag'); hint('Answer Yes or No.'); return; }
  if (!expect || expect.id !== id) {
    flashWrong(BTN[id]); A.buzz();
    if (expect) hint(`Not yet. Press ${LABEL[expect.id]}.`); else hint('Wait.');
    return;
  }
  resolveStep('press');
}
function tickExpect(dt) {
  if (question) {
    question.t += dt;
    if (question.t > 10) { question.t = 0; $('yn').classList.add('nag'); say(question.text); }
    return;
  }
  if (!expect) return;
  expect.t += dt;
  const W = keep.level === 'easy' ? 15 : 8;
  if (!expect.late && expect.t > W) { expect.late = true; expect.nag = 0; setBtn(expect.id, 'late'); cw('alarm', 'red'); }
  if (expect.late) {
    expect.nag -= dt;
    if (expect.nag <= 0) { expect.nag = 7; A.alarm(); say(`Press ${LABEL[expect.id]}!`); }
    if (keep.level === 'normal' && expect.t > W + 14) {
      if (expect.flight) { say('Too late!'); doAbort(true); }
      else if (expect.auto) { say('The computer opened the parachutes for you.'); resolveStep('auto'); }
    }
  }
}
function ask(text) {
  return new Promise((res, rej) => {
    question = reg({ text, t: 0, res, rej });
    $('yn').classList.remove('hide', 'nag'); $('crt').classList.add('ask'); crt(null, text); say(text);
  });
}
function answer(a) {
  A.resume();
  if (!question) return;
  A.click();
  const q = question; question = null; pending.delete(q);
  $('yn').classList.add('hide'); $('yn').classList.remove('nag'); $('crt').classList.remove('ask');
  q.res(a);
}
const TRUTH = { fuel_full: () => G.fuel >= .99, hatch_closed: () => G.hatchClosed };
async function runQuestion(q) {
  let text = q.text;
  for (;;) {
    const a = await ask(text);
    if (q.type === 'check') {
      const truth = TRUTH[q.id] ? TRUTH[q.id]() : true;
      if ((a === 'yes') === truth) { A.chime(); crt(null, q.right[a]); await tell(q.right[a]); return a; }
      A.buzz(); crt(null, q.wrong); await tell(q.wrong); continue;
    }
    const line = a === 'yes' ? q.yes : q.no, act = a === 'yes' ? q.yesAction : q.noAction;
    crt(null, line); await tell(line);
    if (act === 'learn_parts') { setParts(true); await wait(22); text = q.again || q.text; continue; }
    if (act === 'later') { await wait(q.when === 'chute' ? 2 : 7); text = q.again || q.text; continue; }
    return a;
  }
}
async function hook(when, only) {
  for (const q of QUESTIONS) if (q.when === when && q.levels.includes(keep.level) && (!only || q.id === only)) await runQuestion(q);
}

// ───────────────────────── flight profile ─────────────────────────
const climb = pt => (pt < 12 ? 5 * pt : pt < 35 ? 60 * Math.exp(.2228 * (pt - 12)) : 7636 * Math.pow(Math.max(0, 1 - (pt - 35) / 55), 2));
const key = (pt, ks) => { for (let i = 1; i < ks.length; i++) if (pt <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], (pt - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])); return ks[ks.length - 1][1]; };
const pitchAt = pt => key(pt, [[0, 0], [9, 0], [14, 6], [20, 26], [35, 56], [60, 78], [90, 90]]) * DEG;
const rollAt = pt => ease((pt - 6.5) / 4.5) * Math.PI / 2;
const speedAt = pt => key(pt, [[0, 0], [12, 420], [35, 5000], [75, 26500], [90, 28000]]);
const hSpeed = pt => 7800 * smooth(9, 90, pt);

function upAxis() { return V3(0, 1, 0).applyQuaternion(craft.getWorldQuaternion(new THREE.Quaternion())); }
function drop(obj, v, a, w, life = 16) { relFrame.attach(obj); debris.push({ o: obj, v, a, w, life }); }
function puff(pos, n, spd, size, col = [1, 1, 1]) {
  for (let i = 0; i < n; i++) smoke.emit({ pos, vel: V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(spd), size, grow: size * 1.6, life: rnd(1.2, 2.4), col0: col, col1: col, alpha: .5, drag: 1.6 });
}

function sepBoosters() {
  const q = V.rocket.quaternion, ax = upAxis();
  for (const b of V.srbs) {
    const side = Math.sign(b.position.x), out = V3(side, 0, 0).applyQuaternion(q);
    puff(b.localToWorld(V3(0, 51, 0)), 10, 14, 3); puff(b.localToWorld(V3(0, 3, 0)), 10, 14, 3);
    drop(b, out.clone().multiplyScalar(8).addScaledVector(ax, -5), ax.clone().multiplyScalar(-17).addScaledVector(out, 1.5), V3(.05, 0, side * .16), 18);
  }
  G.att.srb = false; A.burst(.7, 700, .6); cw('boost', 'green');
}
function dropFairings() {
  const q = V.rocket.quaternion, ax = upAxis();
  for (const f of V.fairings) { const d = f.userData.dir.clone().applyQuaternion(q); drop(f, d.multiplyScalar(11).addScaledVector(ax, -4), ax.clone().multiplyScalar(-11), V3(rnd(-.5, .5), 0, rnd(-.5, .5)), 10); }
  G.att.fair = false; A.burst(.3, 1200, .4);
}
function dropLAS() {
  const q = V.rocket.quaternion, ax = upAxis(), side = V3(0, 0, 1).applyQuaternion(q);
  drop(V.las, ax.clone().multiplyScalar(12), ax.clone().multiplyScalar(48).addScaledVector(side, 9), V3(.12, 0, 0), 9);
  G.att.las = false; G.lasFire = 1; A.burst(1.2, 900, .6); cw('tower', 'green');
}
function sepCore() {
  const ax = upAxis();
  G.rsT = 0; G.rs = 0;
  drop(V.core, ax.clone().multiplyScalar(-6), ax.clone().multiplyScalar(-5), V3(.02, 0, .03), 26);
  G.att.core = false; G.focusY = 77; cam.o.dist = Math.min(cam.o.dist, 70); A.burst(.5, 500, .5); cw('stage', 'green');
}

// ───────────────────────── the mission script ─────────────────────────
async function mission(from = 'start') {
  try {
    const askFuelEarly = keep.trips % 2 === 0, askHatchEarly = !askFuelEarly;
    if (from === 'start') {
      crt('ON THE CRAWLER', ''); setBtn('roll', '');
      await wait(.8);
      await hook('start');
      await step('roll', 'Press Roll. The crawler carries the rocket to the launch pad.');
      G.rolling = true; crt('ROLL OUT', 'Rolling out to the launch pad.'); say('Rolling out to the launch pad.');
      await until(() => G.rollDone);
      A.chime(); crt('ON THE PAD', 'The rocket is at the launch pad.'); await tell('The rocket is at the launch pad.');
    } else { setBtn('roll', 'done'); crt('ON THE PAD', ''); await wait(1.2); }

    // fuel
    await step('fuel', 'Press Fuel to fill the big tanks.');
    cw('fuel', 'amber'); G.fueling = true; crt('FUELING', 'Filling the tanks. Watch the fuel gauge.'); say('Filling the tanks. Watch the fuel gauge.');
    if (askFuelEarly && keep.level === 'normal') { await until(() => G.fuel >= .5); G.fueling = false; await hook('fuel'); G.fueling = true; crt(null, 'Filling the tanks.'); }
    await until(() => G.fuel >= 1); G.fueling = false;
    if (!askFuelEarly) await hook('fuel');
    cw('fuel', 'green'); A.chime(); crt('ON THE PAD', 'The tanks are full.'); await tell('The tanks are full.');

    // hatch
    if (askHatchEarly) await hook('hatch');
    cw('hatch', 'amber');
    await step('hatch', 'The astronauts are in their seats. Press Hatch to close the door.');
    G.hatchClosed = true; cw('hatch', 'green'); A.burst(.25, 300, .5);
    crt(null, 'The hatch is closed. The crew bridge swings away.'); await tell('The hatch is closed. The crew bridge swings away.');
    if (!askHatchEarly) await hook('hatch');

    // go / no-go
    await hook('ready');

    // engines
    await step('ignite', 'Press Ignite to start the four main engines.');
    G.rsT = 1; cw('engine', 'amber'); crt('ENGINES ON', 'Main engines start!'); say('Main engines start!');
    await wait(3.4); cw('engine', 'green');
    await step('launch', 'The engines are running. Press Launch!');
    crt('COUNTDOWN', 'Three. Two. One.');
    for (const n of [3, 2, 1]) { G.count = n; big(String(n)); A.beep(); say(String(n)); await wait(1.05); }
    G.count = 0; big('LIFTOFF!'); A.tone(1320, .5, 'sine', .25);
    liftoff();
    crt('LIFTOFF', 'Liftoff! The rocket is flying!'); say('Liftoff! The rocket is flying!');
    await wait(1.6); big('');
    await until(() => G.pt >= 9); crt('FLYING', 'The rocket cleared the tower.'); say('The rocket cleared the tower.');
    await until(() => G.pt >= 21); crt(null, 'Faster and faster! Higher and higher!'); say('Faster and faster! Higher and higher!');

    // booster separation
    await until(() => G.pt >= 33);
    cw('boost', 'amber');
    await step('boost', 'The boosters are empty. Press Boosters to let them go.', { flight: true });
    sepBoosters(); crt(null, 'Bye bye, boosters!'); say('Bye bye, boosters!');

    // escape tower
    await until(() => G.pt >= 47);
    cw('tower', 'amber');
    await step('tower', 'We are very high now. Press Tower to drop the escape tower.', { flight: true });
    dropFairings(); await wait(.7); dropLAS();
    crt(null, 'The escape tower is gone. Now the windows are open!'); say('The escape tower is gone. Now the windows are open!');
    await wait(1.5); G.lasFire = 0;

    // core stage
    await until(() => G.pt >= 74.5);
    cw('stage', 'amber');
    await step('stage', 'The big orange tank is empty. Press Stage.', { flight: true });
    sepCore(); crt(null, 'The big tank falls away. The small engine starts.'); say('The big tank falls away. The small engine starts.');
    await wait(1.3); G.rl10 = 1;
    await until(() => G.pt >= 90);
    G.rl10 = 0; G.phase = 'orbit'; G.deployGo = true; A.fanfare();
    crt('IN ORBIT', 'We are in orbit! Look at the Earth.'); await tell('We are in orbit! Look at the Earth. The solar wings open.');
    await wait(6);

    // come home
    await hook('orbit');
    await step('home', 'Press Home to fly back to Earth.');
    await comeHome();
    await descent(false);
  } catch (e) { if (e !== CANCEL) { console.error(e); crt('ERROR', String(e.message || e)); } }
}

function liftoff() {
  G.srbOn = true; G.armGo = true; G.phase = 'ascent';
  scene.attach(V.rocket);
  A.burst(2.5, 400, .9);
}

async function comeHome() {
  crt('COMING HOME', 'Bye bye, upper stage. Orion turns around.'); say('Bye bye, upper stage. Orion turns around.');
  let ax = upAxis();
  drop(V.icps, ax.clone().multiplyScalar(-3.5), V3(), V3(.02, .01, 0), 40);
  G.att.icps = false; G.focusY = 82; cam.o.dist = Math.min(cam.o.dist, 42); A.burst(.3, 600, .4);
  await wait(2.2);
  await tween(4.5, k => { G.pitch = (90 + 180 * ease(k)) * DEG; });
  G.aj10 = 1; crt(null, 'Engine burn! We slow down.'); say('Engine burn! We slow down.');
  await wait(3.6); G.aj10 = 0;
  await wait(.8);
  ax = upAxis();
  drop(V.sm, ax.clone().multiplyScalar(-4.5), V3(), V3(.03, 0, .02), 40);
  G.att.sm = false; G.focusY = 85; cam.o.dist = Math.min(cam.o.dist, 26); A.burst(.3, 600, .4);
  crt(null, 'Only the capsule comes home.'); say('Only the capsule comes home.');
  await wait(3);
  G.phase = 'entry'; crt('RE-ENTRY', 'We fall into the air. It is very hot outside!'); say('We fall into the air. It is very hot outside!');
  const a0 = G.alt;
  await tween(8.5, k => { G.alt = lerp(a0, 62000, ease(k)); G.glow = smooth(.12, .55, k); G.speed = lerp(28000, 9000, k); });
  fade(true); await wait(.9);
}

function startDescent() {
  for (const d of debris) { d.o.removeFromParent(); disposeTree(d.o); }
  debris.length = 0; smoke.clear();
  G.phase = 'descent'; G.glow = 0; G.lasFire = 0; G.rs = G.rsT = 0; G.srbOn = false; G.rl10 = 0; G.aj10 = 0;
  G.theta = 0; G.pitch = 0; G.roll = 0; G.desc = { mode: 'fall', t: 0, tc: 0 }; G.alt = 1280;
  G.focusY = 86; cam.o.dist = 60; cam.o.el = .25; cam.s.dist = 900;
  crt('FALLING', '');
}
async function descent(aborted) {
  startDescent(); fade(false);
  await wait(1.5);
  if (!aborted) {
    crt('FALLING', 'The capsule is falling fast.'); await tell('The capsule is falling fast.');
    await hook('chute'); cw('chute', 'amber');
    await step('chute', 'Press Chute to open the parachutes!', { auto: true });
  } else { crt('ABORT', 'The parachutes open.'); say('The parachutes open.'); }
  G.desc.mode = 'chute'; G.desc.tc = 0; G.focusY = 104; cam.o.dist = Math.max(cam.o.dist, 150); A.burst(.6, 800, .5); cw('chute', 'green');
  crt('PARACHUTES', 'The parachutes are open. We float down slowly.'); say('The parachutes are open. We float down slowly.');
  await until(() => G.alt <= 0);
  // splashdown
  G.phase = 'done'; G.splashT = 0; G.alt = 0; A.burst(1.4, 900, .9);
  const p = V3(site.SPLASH.x, 1, site.SPLASH.z);
  for (let i = 0; i < 70; i++) { const a = rnd(TAU), s = rnd(6, 22); smoke.emit({ pos: p, vel: V3(Math.cos(a) * s, rnd(8, 26), Math.sin(a) * s), size: rnd(2, 5), grow: 5, life: rnd(1.5, 3), col0: [1, 1, 1], col1: [.9, .96, 1], alpha: .7, drag: .9, rise: -14, floor: .5 }); }
  G.focusY = 86; cam.o.dist = Math.min(cam.o.dist, 70);
  const msg = aborted ? 'Splashdown. The crew is safe.' : 'Splashdown! Welcome home!';
  crt('SPLASHDOWN', msg); if (!aborted) A.fanfare();
  await tell(msg);
  await wait(4);
  if (!aborted) { keep.trips++; localStorage.setItem('rocket2Trips', String(keep.trips)); }
  $('endTitle').firstChild.textContent = aborted ? 'CREW IS SAFE' : 'SPLASHDOWN!';
  $('endSub').textContent = aborted ? 'MISSION STOPPED' : 'WELCOME HOME';
  $('stars').textContent = '⭐'.repeat(Math.min(keep.trips, 10)) || '';
  $('end').hidden = false;
}

// ───────────────────────── abort ─────────────────────────
function doAbort(auto = false) {
  if (!G || !V) return;
  if (G.phase === 'pad') {
    if (G.rolling || !G.rollDone) { A.buzz(); hint('Not now.'); return; }
    cancelAll(); big('');
    G.rsT = 0; G.fueling = false; G.hatchClosed = false; G.count = null;
    for (const id of ['fuel', 'hatch', 'ignite', 'launch']) setBtn(id, '');
    for (const id of ['fuel', 'hatch', 'engine']) cw(id, '');
    A.alarm(); crt('LAUNCH STOPPED', 'Launch stopped. The crew is safe. Let’s try again.');
    (async () => {
      try {
        await tween(2.5, k => { G.fuel = Math.min(G.fuel, 1 - k); G.crewArmP = Math.min(G.crewArmP, 1 - k); });
        G.fuel = 0; G.crewArmP = 0;
        await tell('Launch stopped. The crew is safe. Let’s try again.');
        mission('fuel');
      } catch (e) { if (e !== CANCEL) console.error(e); }
    })();
    return;
  }
  if (G.phase !== 'ascent') { A.buzz(); hint('We do not need Abort now.'); return; }
  cancelAll(); big(''); A.alarm();
  crt('ABORT', 'Abort! The capsule flies away from the rocket.'); say(auto ? 'Too late. Abort! The capsule flies away.' : 'Abort! The capsule flies away from the rocket.');
  (async () => {
    try {
      const ax = upAxis(), old = V.rocket;
      const esc = new THREE.Group(); esc.position.copy(old.position); esc.quaternion.copy(old.quaternion); scene.add(esc);
      esc.attach(V.orion);
      if (G.att.las) { esc.attach(V.las); G.lasFire = 1; }
      if (G.att.fair) dropFairings();
      G.rsT = 0; G.srbOn = false; G.escaped = true;
      const v = ax.clone().multiplyScalar(G.att.las ? 30 : 8), acc = ax.clone().multiplyScalar(G.att.las ? 55 : 6);
      const escObj = { o: esc, v, a: acc };
      craft = esc; G.focusY = 86; cam.o.dist = Math.min(cam.o.dist, 60);
      A.burst(1.6, 900, .8);
      await tween(2.6, k => { const dt = lastDt; escObj.v.addScaledVector(escObj.a, dt); esc.position.addScaledVector(escObj.v, dt); });
      fade(true); await wait(.9);
      old.removeFromParent(); disposeTree(old);
      V.las.removeFromParent(); V.sm.removeFromParent(); G.att.las = false; G.att.sm = false; G.att.core = false; G.att.srb = false; G.att.icps = false;
      await descent(true);
    } catch (e) { if (e !== CANCEL) console.error(e); }
  })();
}

// ───────────────────────── simulation ─────────────────────────
const acc = { steam: 0, deck: 0, trail: [0, 0], vent: 0 };
const prevNoz = [null, null];
let lastDt = .016;
function simulate(dt) {
  // roll-out
  if (G.rolling) {
    const v = 26 * Math.min(1, (430 - G.mlZ) / 40 + .12, G.mlZ / 55 + .06);
    G.mlZ = Math.max(0, G.mlZ - v * dt); G.crawlerZ = G.mlZ;
    if (G.mlZ <= 0) { G.rolling = false; G.lowering = true; }
  }
  if (G.lowering) { G.lift = Math.max(0, G.lift - dt * .45); if (G.lift <= 0) { G.lowering = false; G.crawlerLeaving = true; G.rollDone = true; A.burst(.4, 200, .5); } }
  if (G.crawlerLeaving) { G.crawlerZ += 15 * dt; if (G.crawlerZ >= 640) { G.crawlerZ = 640; G.crawlerLeaving = false; } }
  site.ml.position.set(0, rampY(G.mlZ) - PAD_Y + G.lift, G.mlZ);
  site.crawler.position.set(0, rampY(G.crawlerZ), G.crawlerZ);

  // pad systems
  if (G.fueling) G.fuel = Math.min(1, G.fuel + dt / 9);
  G.crewArmP = clamp(G.crewArmP + (G.hatchClosed ? dt / 5 : 0), 0, 1);
  if (G.armGo) G.armP = Math.min(1, G.armP + dt / 1.2);
  site.setArm(site.crewArm, G.crewArmP);
  for (const a of site.arms) site.setArm(a, G.armP);
  for (const m of site.masts) m.rotation.x = -.5 * ease(G.armP);
  G.rs += clamp(G.rsT - G.rs, -dt * 1.4, dt * .55);

  // flight
  if (G.phase === 'ascent') {
    const lim = G.att.srb ? 35 : G.att.core ? 75 : 90, adv = G.pt < lim && !G.escaped;
    G.rate += ((adv ? 1 : .2) - G.rate) * Math.min(1, dt * 2.5);
    if (adv) G.pt = Math.min(lim, G.pt + dt);
    G.met += dt;
    G.alt += climb(G.pt) * G.rate * dt;
    G.theta += hSpeed(G.pt) * G.rate * dt / (R_EARTH + G.alt);
    G.pitch = pitchAt(G.pt); G.roll = rollAt(G.pt);
    G.srb = G.att.srb && G.srbOn ? clamp(1 - (G.pt - 32.5) / 2.5, 0, 1) : 0;
    if (G.pt >= 75 && G.att.core) G.rsT = 0;
    G.speed = speedAt(G.pt) * (.6 + .4 * G.rate);
  } else if (G.phase === 'orbit') {
    G.met += dt; G.theta += 7800 * dt / (R_EARTH + G.alt); G.speed = 28000;
  } else if (G.phase === 'entry') {
    G.met += dt; G.theta += 6500 * dt / (R_EARTH + G.alt);
  } else if (G.phase === 'descent') {
    G.met += dt; const d = G.desc;
    if (d.mode === 'fall') { d.t += dt; G.alt = 380 + 900 * Math.exp(-d.t / 5); G.speed = 120 + 380 * Math.exp(-d.t / 5); }
    else { d.tc += dt; const vd = lerp(58, 13, ease(d.tc / 4.5)); G.alt = Math.max(0, G.alt - vd * dt); G.speed = vd * 3.6; }
  } else if (G.phase === 'done') { G.splashT += dt; G.speed = 0; }
  if (G.phase !== 'ascent') G.srb = 0;
  if (G.deployGo) G.deploy = Math.min(1, G.deploy + dt / 6);

  // vehicle state
  V.setFuel(G.phase === 'pad' ? G.fuel : G.att.core ? clamp(1 - G.pt / 75, 0, 1) : 0);
  V.setDeploy(G.deploy);
  if (G.desc) {
    const d = G.desc, col = G.phase === 'done' ? clamp(1 - G.splashT / 3, 0, 1) : 1;
    V.setChutes(d.mode === 'chute' ? clamp(d.tc / .9, 0, 1) * col : 0, d.mode === 'chute' ? clamp((d.tc - 1.8) / 2.6, 0, 1) * col : 0);
  }

  // craft transform (once free of the launcher)
  if (G.phase === 'descent' || G.phase === 'done') {
    const bob = G.phase === 'done' ? Math.sin(G.splashT * 1.7) * .25 - .9 * (1 - Math.exp(-G.splashT * 2)) + .9 * (1 - Math.exp(-G.splashT * .8)) : 0;
    craft.position.set(site.SPLASH.x, G.alt - 83.05 + bob, site.SPLASH.z);
    const sw = G.phase === 'done' ? .05 : .035;
    craft.quaternion.setFromEuler(new THREE.Euler(Math.sin(G.met * 1.1) * sw, G.met * .05, Math.cos(G.met * .9) * sw));
    // keep the capsule (not the origin 83 m below) as the pivot
    craft.position.add(V3(0, 83.05, 0).sub(V3(0, 83.05, 0).applyQuaternion(craft.quaternion)));
  } else if (G.phase !== 'pad' && !G.escaped) {
    const u = V3(Math.sin(G.theta), Math.cos(G.theta), 0);
    craft.position.copy(C_EARTH).addScaledVector(u, R_EARTH + ROCKET_BASE + G.alt);
    craft.quaternion.setFromAxisAngle(V3(0, 0, 1), -(G.theta + G.pitch)).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), G.roll));
  }
  craft.updateMatrixWorld(true);
  craft.getWorldPosition(relFrame.position);

  // dropped pieces drift away in the rocket's frame
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.v.addScaledVector(d.a, dt); d.o.position.addScaledVector(d.v, dt);
    d.o.rotateX(d.w.x * dt); d.o.rotateY(d.w.y * dt); d.o.rotateZ(d.w.z * dt);
    d.life -= dt;
    if (d.life <= 0) { d.o.removeFromParent(); disposeTree(d.o); debris.splice(i, 1); }
  }

  effects(dt);
}

function effects(dt) {
  const air = 1 - smooth(20000, 90000, G.alt);
  const lenK = G.phase === 'pad' ? .32 : clamp(.32 + G.alt / 75, .32, 1);
  const wide = 1 + smooth(6000, 70000, G.alt) * 3.2;
  FX.srb.forEach(f => f.userData.set(G.att.srb ? G.srb : 0, lenK, wide, dt));
  FX.rs.forEach(f => f.userData.set(G.att.core ? G.rs : 0, lenK, 1 + (wide - 1) * .55, dt));
  FX.rl10.userData.set(G.rl10, 1, 2.2, dt); FX.aj10.userData.set(G.aj10, 1, 1.7, dt);
  FX.las.forEach(f => f.userData.set(G.lasFire, 1, 1, dt));
  FX.glow.userData.set(G.glow);
  FX.light.intensity = (G.srb * 60000 + (G.att.core ? G.rs : 0) * 9000) * (.9 + Math.random() * .2) * (G.escaped ? 0 : 1);
  G.shake = (G.rs * .22 + G.srb) * (G.phase === 'pad' || G.phase === 'ascent' ? air : 0) + G.glow * .9 + G.lasFire * .6 + G.aj10 * .15 + G.rl10 * .1;

  const loud = clamp(G.rs * .28 + G.srb * .8 + G.rl10 * .14 + G.aj10 * .14 + G.lasFire * .5 + G.glow * .5, 0, 1);
  const modeK = cam.mode === 'spectator' ? .6 : cam.mode === 'sky' ? .55 : cam.mode === 'inside' ? .8 : (.35 + .65 * air);
  A.setRumble(loud * modeK * .9, 110 + G.srb * 520 + G.rs * 160 + G.glow * 400);
  A.setWind(G.phase === 'descent' ? (G.desc.mode === 'fall' ? .22 : .08) : 0);

  // smoke and steam
  const onPad = G.phase === 'pad' || G.alt < 130;
  const core = G.att.core ? G.rs : 0;
  if (onPad && core > .05 && G.mlZ <= 0) {
    acc.steam += dt * (55 * core + 210 * G.srb);
    while (acc.steam > 1) {
      acc.steam--;
      const s = Math.random() < .5 ? -1 : 1, hot = G.srb > .1 && Math.random() < .55, k = .55 + .6 * G.srb;
      smoke.emit({ pos: V3(rnd(-8, 8), rnd(3, 9), s * rnd(15, 26)), vel: V3(rnd(-7, 7), rnd(2, 7), s * rnd(40, 85) * k), size: rnd(9, 16), grow: rnd(14, 24), life: rnd(8, 12), col0: hot ? [1, .72, .4] : [1, 1, 1], col1: [.95, .95, .94], alpha: .6, drag: .45, rise: 2.4, floor: 1.5, hot: .1 });
    }
    if (G.srb > .1) {
      acc.deck += dt * 45;
      while (acc.deck > 1) { acc.deck--; const a = rnd(TAU); smoke.emit({ pos: V3(Math.cos(a) * rnd(10, 22), rnd(14, 24), Math.sin(a) * rnd(8, 16)), vel: V3(Math.cos(a) * rnd(10, 30), rnd(4, 14), Math.sin(a) * rnd(10, 30)), size: rnd(7, 12), grow: rnd(10, 16), life: rnd(5, 8), col0: [1, .8, .55], col1: [.93, .92, .9], alpha: .5, drag: .6, rise: 3, floor: 1.5 }); }
    }
  }
  if (G.phase === 'ascent' && G.att.srb && G.srb > .05) {
    const ax = upAxis();
    V.srbs.forEach((b, i) => {
      const p = b.localToWorld(V3(0, -3, 0)), p0 = prevNoz[i] || p;
      acc.trail[i] += dt * 38;
      const n = Math.floor(acc.trail[i]); acc.trail[i] -= n;
      for (let j = 0; j < n; j++) {
        const pos = p0.clone().lerp(p, (j + Math.random()) / n);
        smoke.emit({ pos, vel: ax.clone().multiplyScalar(-rnd(30, 55)).add(V3(rnd(-7, 7), rnd(-7, 7), rnd(-7, 7))), size: rnd(6, 10) * (1 + (wide - 1) * .5), grow: rnd(8, 13) * wide, life: rnd(6, 9), col0: [1, .8, .5], col1: [.94, .93, .91], alpha: .5 * G.srb, drag: .75, floor: G.alt < 200 ? 1.5 : -1e9, hot: .07 });
      }
      prevNoz[i] = p;
    });
  } else { prevNoz[0] = prevNoz[1] = null; }
  if (G.phase === 'pad' && G.fuel > .05 && G.rs < .05) {
    acc.vent += dt * 3;
    while (acc.vent > 1) { acc.vent--; smoke.emit({ pos: V.rocket.localToWorld(V3(-4.3, rnd() < .5 ? 62.4 : 48.6, -1.2)), vel: V3(rnd(-3.5, -1.5), rnd(.2, 1), rnd(-.6, .6)), size: 1.2, grow: 1.7, life: rnd(2.5, 4), alpha: .32, drag: .5, rise: .4 }); }
  }
}

// ───────────────────────── cameras ─────────────────────────
const cam = {
  mode: 'outside', o: { az: .42, el: .09, dist: 155 }, s: { az: .9, el: .72, dist: 1100 }, i: { yaw: 0, pitch: 0 }, sp: { zoom: 1 },
  focusY: 50, aim: V3(0, 77, 0), F: V3(), up: V3(0, 1, 0), alt: 0, dist: 190,
};
const CAM_TAG = {
  outside: ['OUTSIDE VIEW', 'drag to look · pinch to zoom'], inside: ['INSIDE VIEW', 'drag to look around'],
  sky: ['SKY VIEW', 'drag to look · pinch to zoom'], spectator: ['SPECTATOR VIEW', 'pinch to zoom'],
};
const KNOB = { inside: 45, outside: 75, sky: 105, spectator: 135 };
function setCam(mode) {
  cam.mode = mode;
  document.querySelectorAll('.kl').forEach(b => b.classList.toggle('on', b.dataset.cam === mode));
  $('knob').style.transform = `rotate(${KNOB[mode]}deg)`;
  $('camTag').innerHTML = `${CAM_TAG[mode][0]}<small>${CAM_TAG[mode][1]}</small>`;
  A.click();
}
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
function updateCamera(dt) {
  cam.focusY += (G.focusY - cam.focusY) * Math.min(1, dt * 2.5);
  const F = cam.F.copy(craft.localToWorld(V3(0, cam.focusY, 0)));
  const up = cam.up.copy(F).sub(C_EARTH).normalize();
  const east = V3(up.y, -up.x, 0).normalize(), south = V3(0, 0, 1);
  let near = .5, fov = 45;
  if (cam.mode === 'outside' || cam.mode === 'sky') {
    const r = cam.mode === 'outside' ? cam.o : cam.s;
    const cx = Math.cos(r.el) * Math.sin(r.az), cy = Math.sin(r.el), cz = Math.cos(r.el) * Math.cos(r.az);
    camera.position.copy(F).addScaledVector(east, cx * r.dist).addScaledVector(up, cy * r.dist).addScaledVector(south, cz * r.dist);
    const a = camera.position.distanceTo(C_EARTH) - R_EARTH;
    if (a < 2.5) camera.position.addScaledVector(up, 2.5 - a);
    camera.up.copy(up); camera.lookAt(F);
    near = cam.mode === 'sky' ? 5 : (r.dist > 60 ? 1 : .3); fov = cam.mode === 'sky' ? 40 : 45; cam.dist = r.dist;
  } else if (cam.mode === 'spectator') {
    camera.position.copy(site.spectator.pos);
    cam.aim.lerp(F, Math.min(1, dt * 3.5));
    camera.up.set(0, 1, 0); camera.lookAt(cam.aim);
    near = 2; fov = 22 / cam.sp.zoom; cam.dist = camera.position.distanceTo(F);
  } else {
    const eye = V3(...K.CABIN_EYE), f = V3(...K.CABIN_LOOK).sub(eye).normalize();
    const upL = V3(0, f.z, -f.y).normalize(), right = f.clone().cross(upL).normalize();
    _m.makeBasis(right, upL, f.clone().negate());
    const qLocal = new THREE.Quaternion().setFromRotationMatrix(_m);
    qLocal.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(cam.i.pitch, cam.i.yaw, 0, 'YXZ')));
    camera.position.copy(V.cm.localToWorld(eye));
    camera.quaternion.copy(V.cm.getWorldQuaternion(_q)).multiply(qLocal);
    near = .05; fov = 74; cam.dist = 3;
  }
  if (G.shake > .01) {
    const amp = G.shake * (cam.mode === 'inside' ? .02 : cam.mode === 'outside' ? .1 * clamp(160 / cam.dist, .2, 1.4) : cam.mode === 'spectator' ? .0 : 0);
    camera.position.add(V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(amp));
  }
  if (camera.near !== near || camera.fov !== fov) { camera.near = near; camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);
  cam.alt = camera.position.distanceTo(C_EARTH) - R_EARTH;

  // environment that depends on where the camera is
  const space = smooth(9000, 85000, cam.alt);
  sky.update(camera, cam.alt, SUN_DIR, up);
  stars.update(camera, space);
  earth.setAlt(cam.alt);
  scene.fog.density = 4.8e-5 * Math.exp(-Math.max(0, cam.alt) / 6000);
  scene.fog.color.copy(sky.horizonColor(space));
  scene.environmentIntensity = lerp(.55, .12, space);
  hemi.intensity = lerp(.9, .22, space);
  // sun + shadow follow the craft
  const sf = craft.localToWorld(V3(0, G.phase === 'pad' ? 55 : cam.focusY, 0));
  if (G.phase === 'pad') sf.y = Math.min(sf.y, 70);
  sun.position.copy(sf).addScaledVector(SUN_DIR, 700); sun.target.position.copy(sf); sun.target.updateMatrixWorld();
  setShadowHalf(G.phase === 'pad' || G.alt < 400 ? 170 : 90);
}

// ───────────────────────── learning pins ─────────────────────────
const pins = [];
let selPin = null;
const SVGNS = 'http://www.w3.org/2000/svg';
function buildPins() {
  const hud = $('hud'); hud.innerHTML = '';
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.style.cssText = 'position:absolute;inset:0;pointer-events:none'; hud.appendChild(svg);
  for (const p of PARTS) {
    const el = document.createElement('button'); el.className = 'pin'; el.textContent = p.icon || '•'; el.style.display = 'none';
    el.setAttribute('aria-label', p.kid || p.name);
    el.addEventListener('click', e => { e.stopPropagation(); showCard(p, el); });
    const ln = document.createElementNS(SVGNS, 'line'); ln.setAttribute('stroke', '#ffd45c'); ln.setAttribute('stroke-width', '2'); ln.style.display = 'none';
    const dot = document.createElementNS(SVGNS, 'circle'); dot.setAttribute('r', '3.5'); dot.setAttribute('fill', '#ffd45c'); dot.style.display = 'none';
    svg.appendChild(ln); svg.appendChild(dot);
    hud.appendChild(el); pins.push({ p, el, ln, dot, a: V3(...p.anchor), sx: 0, sy: 0 });
  }
}
function showCard(p, el) {
  A.resume(); A.click();
  if (selPin) selPin.classList.remove('sel'); selPin = el; el.classList.add('sel');
  $('cardIcon').textContent = p.icon || ''; $('cardKid').textContent = p.kid || p.name; $('cardName').textContent = p.name;
  $('cardWhat').textContent = p.what; $('cardWhy').textContent = p.why; $('card').hidden = false;
  if (!question && !(expect && expect.late)) say(`${p.kid || p.name}. ${p.what} ${p.why}`);
}
function hideCard() { $('card').hidden = true; if (selPin) selPin.classList.remove('sel'); selPin = null; }
function setParts(on) { keep.parts = on; $('optParts').classList.toggle('on', on); if (!on) { hideCard(); for (const x of pins) x.el.style.display = x.ln.style.display = x.dot.style.display = 'none'; } }
function setCut(on) { keep.cut = on; $('optCut').classList.toggle('on', on); if (V) V.setCut(on); }
const _v = V3();
const PIN_TRY = [[0, 0], [46, -8], [-46, -8], [46, 26], [-46, 26], [92, 0], [-92, 0], [92, -34], [-92, -34], [138, 10], [-138, 10], [138, -40], [-138, -40], [184, 0], [-184, 0]];
function updatePins() {
  if (!keep.parts) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pxPerM = d => (h / 2) / (Math.tan(camera.fov * DEG / 2) * Math.max(d, .1));
  const attached = k => (k === 'site' || k === 'cm' ? true : !!G.att[k]);
  const shown = [];
  for (const x of pins) {
    const p = x.p; let show = cam.mode !== 'inside' && attached(p.attached) && !G.escaped;
    if (show && p.view === 'cutaway' && !keep.cut) show = false;
    if (show && p.view === 'outside' && keep.cut) show = false;
    if (show) {
      if (p.frame === 'rocket') V.rocket.localToWorld(_v.copy(x.a));
      else if (p.frame === 'ml') site.ml.localToWorld(_v.copy(x.a));
      else if (p.frame === 'crawler') site.crawler.localToWorld(_v.copy(x.a));
      else _v.copy(x.a);
      const d = _v.distanceTo(camera.position), k = pxPerM(d);
      if (p.frame === 'rocket' ? k < 1.6 : (k < .32 || cam.alt > 5000)) show = false;
      if (show) {
        _v.project(camera);
        if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > .97 || Math.abs(_v.y) > .94) show = false;
        else { x.sx = (_v.x + 1) / 2 * w; x.sy = (1 - _v.y) / 2 * h; shown.push(x); }
      }
    }
    if (!show) x.el.style.display = x.ln.style.display = x.dot.style.display = 'none';
  }
  // keep the icons from sitting on top of each other; a line joins each icon to its part
  shown.sort((a, b) => a.sy - b.sy);
  const placed = [];
  for (const x of shown) {
    let px = x.sx, py = x.sy;
    for (const [ox, oy] of PIN_TRY) {
      const cx = clamp(x.sx + ox, 22, w - 22), cy = clamp(x.sy + oy, 22, h - 22);
      px = cx; py = cy;
      if (placed.every(q => Math.hypot(q[0] - cx, q[1] - cy) > 42)) break;
    }
    placed.push([px, py]);
    x.el.style.display = ''; x.el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
    const far = Math.hypot(px - x.sx, py - x.sy) > 6;
    x.ln.style.display = x.dot.style.display = far ? '' : 'none';
    if (far) {
      x.ln.setAttribute('x1', x.sx.toFixed(1)); x.ln.setAttribute('y1', x.sy.toFixed(1)); x.ln.setAttribute('x2', px.toFixed(1)); x.ln.setAttribute('y2', py.toFixed(1));
      x.dot.setAttribute('cx', x.sx.toFixed(1)); x.dot.setAttribute('cy', x.sy.toFixed(1));
    }
  }
}

// ───────────────────────── readouts ─────────────────────────
let roT = 0, scrT = 0, lastClock = '';
const fmtAlt = a => (a < 1000 ? `${Math.round(a)} m` : `${(a / 1000).toFixed(a < 100000 ? 1 : 0)} km`);
function readouts(dt) {
  roT += dt; scrT += dt;
  if (roT < .1) return; roT = 0;
  let clock;
  if (G.phase === 'pad') clock = G.count ? `T-00:0${G.count}` : 'T-00:10';
  else { const s = Math.floor(G.met); clock = `T+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  const spd = Math.round(G.speed / (G.speed > 1000 ? 100 : 1)) * (G.speed > 1000 ? 100 : 1);
  $('crtClock').textContent = clock; $('crtAlt').textContent = fmtAlt(G.alt); $('crtSpd').textContent = spd.toLocaleString('en-US') + ' km/h';
  gauge(G.phase === 'pad' ? G.fuel : G.att.core ? clamp(1 - G.pt / 75, 0, 1) : 0);
  if (clock !== lastClock) { lastClock = clock; site.setClock(clock.replace('T-', 'T- ').replace('T+', 'T+ ')); }
  if (scrT > .3) {
    scrT = 0;
    V.drawScreen({ alt: (G.alt / 1000).toFixed(G.alt < 100000 ? 1 : 0), spd: spd.toLocaleString('en-US'), clock, phase: G.phase === 'pad' ? 'READY' : G.phase === 'ascent' ? 'ASCENT' : G.phase === 'orbit' ? 'ORBIT' : G.phase === 'entry' ? 'ENTRY' : 'LANDING' });
  }
}

// ───────────────────────── main loop ─────────────────────────
// ?test drives the loop from a timer (automated checks in a hidden browser); normal play uses requestAnimationFrame
const raf = /[?&]test\b/.test(location.search) ? cb => setTimeout(() => cb(performance.now()), 16) : cb => requestAnimationFrame(cb);
let lastT = 0, running = false;
const dbg = { speed: 1 };
function frame(tms) {
  raf(frame);
  const dt = Math.min(.05, Math.max(.001, (tms - lastT) / 1000 || .016)); lastT = tms; lastDt = dt;
  if (!G || !V) return;
  for (let k = 0; k < dbg.speed; k++) {
    if (running) { tickWaits(dt); tickExpect(dt); }
    if (!G || !V) return;
    simulate(dt);
    smoke.update(dt);
  }
  site.update(dt);
  updateCamera(dt);
  updatePins(); readouts(dt);
  renderer.render(scene, camera);
}
function resize() {
  const v = $('view'), w = Math.max(2, v.clientWidth), h = Math.max(2, v.clientHeight);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('view')); window.addEventListener('orientationchange', resize); resize();

function newMission(from = 'start') {
  cancelAll(); big(''); fade(false); hideCard();
  unmountVehicle(); smoke.clear();
  G = freshG();
  mountVehicle();
  for (const id in BTN) setBtn(id, '');
  for (const id of ['fuel', 'hatch', 'engine', 'boost', 'tower', 'stage', 'chute', 'alarm']) cw(id, '');
  cam.o.az = .42; cam.o.el = .09; cam.o.dist = 155; cam.s.az = .9; cam.s.el = .72; cam.s.dist = 1100; cam.sp.zoom = 1; cam.i.yaw = cam.i.pitch = 0; cam.focusY = 50;
  cam.aim.set(0, 77, 430);
  simulate(.016);
  mission(from);
}

// ───────────────────────── input ─────────────────────────
for (const id in BTN) BTN[id].addEventListener('click', () => onPress(id));
$('bYes').addEventListener('click', () => answer('yes'));
$('bNo').addEventListener('click', () => answer('no'));
let coverTimer = 0;
function setCover(open) { $('abortCover').classList.toggle('open', open); }
$('abortCover').addEventListener('click', () => { A.resume(); A.click(); setCover(true); clearTimeout(coverTimer); coverTimer = setTimeout(() => { if (keep.level === 'normal') setCover(false); }, 5000); });
$('bAbort').addEventListener('click', () => { A.resume(); doAbort(false); });
function setLevel(lv) {
  keep.level = lv; $('optLevelTxt').textContent = lv === 'easy' ? 'Easy' : 'Normal'; $('optLevel').classList.toggle('on', lv === 'normal');
  setCover(lv === 'easy'); $('abortCover').textContent = lv === 'easy' ? '' : 'LIFT';
}
$('optLevel').addEventListener('click', () => { A.resume(); A.click(); setLevel(keep.level === 'easy' ? 'normal' : 'easy'); say(keep.level === 'easy' ? 'Easy.' : 'Normal.'); });
$('optParts').addEventListener('click', () => { A.resume(); A.click(); setParts(!keep.parts); if (keep.parts) hint('Tap a picture to learn a part.'); });
$('optCut').addEventListener('click', () => { A.resume(); A.click(); setCut(!keep.cut); if (keep.cut) hint('Now we can see inside the rocket.'); });
document.querySelectorAll('.kl').forEach(b => b.addEventListener('click', () => { A.resume(); setCam(b.dataset.cam); }));
$('knob').addEventListener('click', () => { A.resume(); const order = ['inside', 'outside', 'sky', 'spectator']; setCam(order[(order.indexOf(cam.mode) + 1) % 4]); });
$('btnSound').addEventListener('click', () => { A.init(); A.resume(); A.setMuted(!A.muted); });
$('cardX').addEventListener('click', hideCard);
$('again').addEventListener('click', () => { A.resume(); $('end').hidden = true; newMission('start'); });

const ptrs = new Map(); let pinch0 = 0;
const pdist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
function zoom(k) {
  if (cam.mode === 'outside') cam.o.dist = clamp(cam.o.dist * k, 9, 460);
  else if (cam.mode === 'sky') cam.s.dist = clamp(cam.s.dist * k, 260, 60000);
  else if (cam.mode === 'spectator') cam.sp.zoom = clamp(cam.sp.zoom / k, 1, 10);
}
canvas.addEventListener('pointerdown', e => { try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) pinch0 = pdist(); });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    if (cam.mode === 'outside') { cam.o.az -= dx * .006; cam.o.el = clamp(cam.o.el + dy * .005, -.25, 1.5); }
    else if (cam.mode === 'sky') { cam.s.az -= dx * .006; cam.s.el = clamp(cam.s.el + dy * .005, .12, 1.52); }
    else if (cam.mode === 'inside') { cam.i.yaw = clamp(cam.i.yaw + dx * .004, -1.3, 1.3); cam.i.pitch = clamp(cam.i.pitch + dy * .004, -.8, .8); }
  } else if (ptrs.size === 2) { const d = pdist(); if (pinch0 > 0 && d > 0) zoom(pinch0 / d); pinch0 = d; }
});
const pend = e => { ptrs.delete(e.pointerId); pinch0 = 0; };
canvas.addEventListener('pointerup', pend); canvas.addEventListener('pointercancel', pend);
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(e.deltaY * .0015)); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) { A.setRumble(0, 100); try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } });

// ───────────────────────── boot ─────────────────────────
async function boot() {
  const [pj, qj] = await Promise.all([fetch('rocket2_parts.json').then(r => r.json()), fetch('rocket2_questions.json').then(r => r.json())]);
  PARTS = pj.parts || []; QUESTIONS = qj.questions || [];
  buildPins();
  G = freshG(); mountVehicle(); simulate(.016);
  A.setMuted(A.muted); setLevel('easy'); setCam('outside');
  crt('READY', 'Choose Easy or Normal to start.');
  raf(frame);
  window.__r2ready = true;
  $('loadMsg').textContent = 'Choose a level to start.';
  const go = lv => {
    A.init(); A.resume();
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
    setLevel(lv); $('start').hidden = true; running = true;
    newMission('start');
  };
  $('goEasy').disabled = false; $('goNormal').disabled = false;
  $('goEasy').addEventListener('click', () => go('easy'));
  $('goNormal').addEventListener('click', () => go('normal'));
}
boot().catch(e => { console.error(e); $('loadMsg').textContent = 'Could not load the game: ' + (e.message || e); });

// small hooks for automated checks
window.__r2 = { dbg, get G() { return G; }, get V() { return V; }, cam, setCam, setCut, setParts, onPress, answer, doAbort, scene, camera, renderer, smoke, debris, get expect() { return expect; }, get question() { return question; } };
