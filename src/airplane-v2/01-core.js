import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
window.__v2ok = true;

/* ═══ UTIL ═══ */
const $ = id => document.getElementById(id);
const $$ = s => document.querySelectorAll(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const DEG = Math.PI / 180;
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapDeg = d => ((d % 360) + 360) % 360;
const angDiff = (a, b) => { let d = wrapDeg(b - a); return d > 180 ? d - 360 : d; };
const isWhite = h => { const c = new THREE.Color(h); return c.r > .8 && c.g > .8 && c.b > .8; };

/* ═══ DATA ═══ */
const AIRLINES = JSON.parse($('airline-data').textContent);
let SCRIPTS = JSON.parse($('airplane-scripts').textContent);
// When served over http(s) pick up live edits of the JSON without rebuilding.
if (location.protocol.startsWith('http')) {
  fetch('airplane_scripts.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && j.renders && j.renders.length) SCRIPTS = j; }).catch(() => {});
}
const RENDER = () => {
  if (!RENDER._src || RENDER._src !== SCRIPTS) {
    RENDER._src = SCRIPTS; RENDER._map = new Map(SCRIPTS.renders.map(r => [r.key, r]));
    RENDER._lines = new Map(SCRIPTS.lines.map(l => [l.id, l]));
  }
  return RENDER._map;
};
const lineInfo = id => { RENDER(); return RENDER._lines.get(id); };
const tod = () => { const h = new Date().getHours(); return h < 12 && h >= 5 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; };

/* ═══ STATE (shared) ═══ */
let AL = null;            // chosen airline
let GAME = 'takeoff';     // 'takeoff' | 'sky'
let level = 'easy';

/* ═══ AUDIO (synth fallbacks + optional files) ═══ */
let A = null;
let muted = (() => { try { return localStorage.getItem('airplaneMuted') === '1'; } catch (e) { return false; } })();
function initA() {
  if (!A) { A = new (window.AudioContext || window.webkitAudioContext)(); }
  if (A.state === 'suspended' && !muted) A.resume();
  loadSfxFiles();
}
function tone(f, d, ty = 'sine', g = .14, f2 = null, when = 0) {
  if (!A || muted) return;
  const t0 = A.currentTime + when;
  const o = A.createOscillator(), gn = A.createGain(); o.connect(gn); gn.connect(A.destination);
  o.type = ty; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.linearRampToValueAtTime(f2, t0 + d);
  gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(.001, t0 + d);
  o.start(t0); o.stop(t0 + d + .02);
}
let noiseBuf = null;
function getNoise() {
  if (noiseBuf) return noiseBuf;
  const sz = A.sampleRate * 2; noiseBuf = A.createBuffer(1, sz, A.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function noisy(d, g = .1, fc = 800) {
  if (!A || muted) return;
  const s = A.createBufferSource(), f = A.createBiquadFilter(), gn = A.createGain();
  f.type = 'bandpass'; f.frequency.value = fc; s.buffer = getNoise(); s.connect(f); f.connect(gn); gn.connect(A.destination);
  gn.gain.setValueAtTime(g, A.currentTime); gn.gain.exponentialRampToValueAtTime(.001, A.currentTime + d);
  s.start(); s.stop(A.currentTime + d + .02);
}

// Optional real sound files from airplane_scripts.json "sfx" (assets/airplane/sfx/*).
// HTMLAudio works from file:// too. Missing files silently keep the synth version.
const SFX_FILES = {};
let sfxLoaded = false;
function loadSfxFiles() {
  if (sfxLoaded) return; sfxLoaded = true;
  Object.entries(SCRIPTS.sfx || {}).forEach(([k, v]) => {
    const a = new Audio(); a.preload = 'auto'; a.loop = !!v.loop;
    const rec = { el: a, ok: false, loop: !!v.loop };
    a.addEventListener('canplaythrough', () => { rec.ok = true; }, { once: true });
    a.addEventListener('error', () => { rec.ok = false; }, { once: true });
    a.src = v.file; SFX_FILES[k] = rec;
  });
}
function playFile(k, vol = 1) {
  const r = SFX_FILES[k]; if (!r || !r.ok || muted) return false;
  const a = r.el.cloneNode(); a.volume = vol; a.play().catch(() => {}); return true;
}
const SYN = {
  engine_start: () => { tone(75, 2.2, 'sawtooth', .13, 230); noisy(2.2, .05); },
  gear_motion: () => { noisy(.35, .13); tone(180, .35, 'sine', .09); tone(240, .18, 'sine', .08, null, .35); },
  flaps_motion: () => { tone(340, .4, 'sawtooth', .05, 300); tone(300, .4, 'sine', .07); },
  seatbelt_ding: () => { tone(880, .5, 'sine', .16); },
  pa_chime: () => { tone(988, .5, 'sine', .16); tone(784, .7, 'sine', .14, null, .45); },
  call_bell: () => { tone(1320, .35, 'sine', .14); },
  door_close: () => { noisy(.25, .25, 200); tone(70, .3, 'sine', .25); },
  success: () => { tone(520, .14, 'sine', .15); tone(780, .22, 'sine', .15, null, .14); },
  success_big: () => { [523, 659, 784].forEach((f, i) => tone(f, .3, 'sine', .14, null, i * .11)); },
  cruise_jingle: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .36, 'sine', .13, null, i * .13)); },
  error: () => { tone(290, .22, 'sine', .18, 240); },
  rotate_cue: () => { tone(440, .14, 'sine', .2); tone(660, .14, 'sine', .2, null, .14); tone(880, .3, 'sine', .2, null, .28); },
  gear_horn: () => { for (let n = 0; n < 4; n++) tone(244, .22, 'square', .13, null, n * .3); },
  pushback_beep: () => { tone(940, .14, 'square', .09); },
  thunder: () => { noisy(2.5, .35, 90); noisy(1.2, .15, 300); },
  master_caution: () => { tone(1100, .18, 'square', .1); tone(1100, .18, 'square', .1, null, .3); },
};
function sfx(k, vol = 1) { if (muted) return; if (!playFile(k, vol)) SYN[k] && SYN[k](); }

// Continuous engine sound: file loop if present, else filtered noise + low saw.
const ENG = { level: 0, target: 0, nodes: null, file: null, cabinFile: null };
function engineSet(level) { ENG.target = clamp(level, 0, 1); }
function engineTick(dt) {
  ENG.level = damp(ENG.level, ENG.target, 1.5, dt);
  if (!A || muted) { stopEngineNodes(); return; }
  const f = SFX_FILES.engine_loop;
  if (f && f.ok) {
    if (!ENG.file) { ENG.file = f.el; ENG.file.loop = true; ENG.file.play().catch(() => {}); }
    ENG.file.volume = clamp(ENG.level * .9, 0, 1);
    return;
  }
  if (ENG.level < .01 && !ENG.nodes) return;
  if (!ENG.nodes) {
    const src = A.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = A.createGain(); g.gain.value = 0;
    const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
    const og = A.createGain(); og.gain.value = 0;
    const whine = A.createOscillator(); whine.type = 'sine'; whine.frequency.value = 900;
    const wg = A.createGain(); wg.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(A.destination);
    o.connect(og); og.connect(A.destination); whine.connect(wg); wg.connect(A.destination);
    src.start(); o.start(); whine.start();
    ENG.nodes = { src, lp, g, o, og, whine, wg };
  }
  const n = ENG.nodes, L = ENG.level, t = A.currentTime;
  n.g.gain.setTargetAtTime(L * .22, t, .1);
  n.lp.frequency.setTargetAtTime(300 + L * 1800, t, .1);
  n.o.frequency.setTargetAtTime(55 + L * 70, t, .1);
  n.og.gain.setTargetAtTime(L * .035, t, .1);
  n.whine.frequency.setTargetAtTime(700 + L * 2600, t, .1);
  n.wg.gain.setTargetAtTime(L * .012, t, .1);
}
function stopEngineNodes() {
  if (ENG.nodes) { const n = ENG.nodes; try { n.src.stop(); n.o.stop(); n.whine.stop(); } catch (e) {} ENG.nodes = null; }
  if (ENG.file) { ENG.file.pause(); ENG.file = null; }
}
let turbLoop = null;
function turbulenceSound(on) {
  const f = SFX_FILES.turbulence;
  if (on && f && f.ok && !muted) { if (!turbLoop) { turbLoop = f.el; turbLoop.loop = true; turbLoop.play().catch(() => {}); } }
  else if (turbLoop) { turbLoop.pause(); turbLoop = null; }
  if (on && !(f && f.ok) && A && !muted && Math.random() < .08) noisy(.3, .12, 120 + Math.random() * 200);
}

/* ═══ VOICE ═══
   Plays recorded clips from airplane_scripts.json renders when the file exists,
   otherwise speaks the same text with speechSynthesis. A "say" is a queue of
   parts so callsign + instruction clips can play back to back. */
const voiceEl = new Audio();
let voiceSeq = 0;
const ROLE_LABEL = { captain: 'CAPTAIN', first_officer: 'FIRST OFFICER', purser: 'CABIN CREW', ramp: 'GROUND CREW',
  ground: 'GROUND CONTROL', tower: 'TOWER', center: 'ATC CENTER', tcas: 'TCAS' };
let subT = null;
function subtitle(role, text) {
  const s = $('subtitle'); s.innerHTML = `<b>${ROLE_LABEL[role] || role}</b>${text}`; s.classList.add('show');
  clearTimeout(subT); subT = setTimeout(() => s.classList.remove('show'), Math.max(2500, text.length * 70));
}
function renderFor(lineId, variant) {
  const map = RENDER(); const v = variant != null ? '.' + variant : '';
  return map.get(`${AL?.id}|${lineId}${v}`) || map.get(`common|${lineId}${v}`);
}
function cancelVoice() {
  voiceSeq++; voiceEl.pause(); try { speechSynthesis.cancel(); } catch (e) {}
}
// say(lineId, {variant, cb, interrupt})
function say(lineId, opts = {}) {
  const info = lineInfo(lineId); if (!info) { console.warn('no line', lineId); opts.cb && opts.cb(); return; }
  const main = renderFor(lineId, opts.variant); if (!main) { console.warn('no render', lineId); opts.cb && opts.cb(); return; }
  const parts = [];
  const cs = info.prefix === 'callsign' || info.suffix === 'callsign' ? renderFor('atc.callsign') : null;
  if (cs && info.prefix) parts.push(cs);
  parts.push(main);
  if (cs && info.suffix) parts.push(cs);
  const text = parts.map(p => p.text).join(' ');
  subtitle(info.role, text);
  const seq = ++voiceSeq;
  const done = () => { if (seq === voiceSeq) opts.cb && opts.cb(); };
  if (muted) { setTimeout(done, Math.min(1800, 300 + text.length * 25)); return; }
  voiceEl.pause(); try { speechSynthesis.cancel(); } catch (e) {}
  const v = SCRIPTS.voices?.[info.role] || {};
  const startParts = () => playParts(parts, 0, v, seq, done);
  if (info.chime) { sfx('pa_chime'); setTimeout(() => { if (seq === voiceSeq) startParts(); }, 1150); }
  else startParts();
}
function playParts(parts, i, v, seq, done) {
  if (seq !== voiceSeq) return;
  if (i >= parts.length) { done(); return; }
  const p = parts[i];
  const next = () => playParts(parts, i + 1, v, seq, done);
  let fellBack = false;
  const tts = () => {
    if (fellBack || seq !== voiceSeq) return; fellBack = true;
    // speak the rest of the queue as one utterance (smoother than clip by clip)
    const rest = parts.slice(i).map(x => x.text).join(' ');
    if (!window.speechSynthesis) { setTimeout(done, 1200); return; }
    const u = new SpeechSynthesisUtterance(rest); u.rate = v.rate || .95; u.pitch = v.pitch || 1; u.lang = 'en-US';
    let fired = false; const fin = () => { if (!fired) { fired = true; done(); } };
    u.onend = fin; u.onerror = fin;
    setTimeout(fin, 1500 + rest.length * 110); // safety: some browsers never fire onend
    speechSynthesis.speak(u);
  };
  voiceEl.onended = next; voiceEl.onerror = tts;
  voiceEl.src = p.file; voiceEl.currentTime = 0;
  voiceEl.play().catch(tts);
}
function setMuted(next) {
  muted = next; try { localStorage.setItem('airplaneMuted', muted ? '1' : '0'); } catch (e) {}
  const b = $('sound-sim');
  if (b) { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(muted)); b.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off'); }
  if (muted) { cancelVoice(); stopEngineNodes(); turbulenceSound(false); try { A && A.suspend(); } catch (e) {} }
  else { try { A && A.resume(); } catch (e) {} }
}

/* ═══ FEEDBACK ═══ */
let fbT = null;
function fb(word, kind) {
  sfx(kind === 'ok' ? 'success' : 'error');
  const e = $('fb'); e.textContent = word; e.className = 'show ' + kind;
  const fl = $('flash'); fl.className = ''; void fl.offsetWidth; fl.className = kind === 'err' ? 'f-r' : kind === 'wait' ? 'f-a' : 'f-g';
  clearTimeout(fbT); fbT = setTimeout(() => { e.className = ''; }, kind === 'ok' ? 1400 : 1600);
}
function hold(el, s, e) {
  el.addEventListener('touchstart', s, { passive: false }); el.addEventListener('touchend', e, { passive: false });
  el.addEventListener('touchcancel', e, { passive: false });
  el.addEventListener('mousedown', s); el.addEventListener('mouseup', e); el.addEventListener('mouseleave', e);
}
function tap(el, f) {
  el.addEventListener('touchend', ev => { ev.preventDefault(); f(ev); }, { passive: false });
  el.addEventListener('click', f);
}
