import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
window.__t205ok = true;

/* ═══ UTIL ═══ */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const DEG = Math.PI / 180;
// deterministic random so the world is the same every time
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = mulberry(205);
const rr = (a, b) => a + R() * (b - a);
const pick = arr => arr[Math.floor(R() * arr.length)];

/* ═══ DATA ═══ */
const STATIONS = JSON.parse($('stations-data').textContent);
let SCRIPTS = JSON.parse($('train-scripts').textContent);
if (location.protocol.startsWith('http')) {
  fetch('train_205_scripts.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && j.renders && j.renders.length) SCRIPTS = j; }).catch(() => {});
}

/* ═══ GAME STATE (shared) ═══ */
const G = {
  mode: 'regular',      // 'regular' | 'race'
  running: false,
  t: 0,
};

/* ═══ AUDIO BASICS ═══ */
let A = null, master = null;
let muted = (() => { try { return localStorage.getItem('t205Muted') === '1'; } catch (e) { return false; } })();
function initA() {
  if (!A) {
    A = new (window.AudioContext || window.webkitAudioContext)();
    master = A.createGain(); master.gain.value = muted ? 0 : 1; master.connect(A.destination);
  }
  if (A.state !== 'running') A.resume().catch(() => {});   // iOS: 'suspended' or 'interrupted'
  unlockVoice();
  loadSfxFiles();
}
function tone(f, d, ty = 'sine', g = .14, f2 = null, when = 0, dest = null) {
  if (!A) return;
  const t0 = A.currentTime + when;
  const o = A.createOscillator(), gn = A.createGain(); o.connect(gn); gn.connect(dest || master);
  o.type = ty; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.linearRampToValueAtTime(f2, t0 + d);
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(g, t0 + .01); gn.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.start(t0); o.stop(t0 + d + .03);
}
let noiseBuf = null;
function getNoise() {
  if (noiseBuf) return noiseBuf;
  const sz = A.sampleRate * 2; noiseBuf = A.createBuffer(1, sz, A.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function noisy(d, g = .1, fc = 800, q = 1, when = 0, type = 'bandpass') {
  if (!A) return;
  const t0 = A.currentTime + when;
  const s = A.createBufferSource(), f = A.createBiquadFilter(), gn = A.createGain();
  f.type = type; f.frequency.value = fc; f.Q.value = q; s.buffer = getNoise(); s.connect(f); f.connect(gn); gn.connect(master);
  gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  s.start(t0, Math.random()); s.stop(t0 + d + .03);
}
function setMuted(m) {
  muted = m; try { localStorage.setItem('t205Muted', m ? '1' : '0'); } catch (e) {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, A.currentTime, .05);
  $('mute').textContent = m ? '🔇' : '🔊';
  if (m) cancelVoice();
}

/* ═══ VOICE ═══
   say('line_id', {station, cb}) plays the Japanese then the English render.
   Recorded mp3 (render.file) is used when it exists, otherwise speechSynthesis. */
const voiceEl = new Audio();
let voiceSeq = 0, subT = null;
function renderFor(id, lang, station) {
  const map = RENDERS();
  return map.get(`${station || 'common'}|${id}|${lang}`) || map.get(`common|${id}|${lang}`);
}
function RENDERS() {
  if (RENDERS._src !== SCRIPTS) { RENDERS._src = SCRIPTS; RENDERS._m = new Map(SCRIPTS.renders.map(r => [r.key, r])); }
  return RENDERS._m;
}
function showSub(ja, en) {
  const s = $('subtitle'); s.innerHTML = `${ja || ''}${en ? `<span class="en">${en}</span>` : ''}`; s.classList.add('show');
  clearTimeout(subT); subT = setTimeout(() => s.classList.remove('show'), Math.max(3500, ((ja || '').length + (en || '').length) * 85));
}
function cancelVoice() { voiceSeq++; voiceBusy = false; voiceEl.pause(); stopSpeech(); }
/* Browser speech is fragile: an utterance spoken right after cancel() can be dropped,
   Chrome may forget an utterance before it ends, cuts long ones off after ~15 s, and
   sometimes never starts one. speakNow() works around all of that. */
const SPEAK = {
  keep: null, ka: 0, cancelAt: -1e9,
  ios: /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  chrome: /Chrome\//.test(navigator.userAgent),
};
function stopSpeech() {
  try { if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); SPEAK.cancelAt = performance.now(); } } catch (e) {}
}
function speakNow(u, ok = () => true) {
  const ss = speechSynthesis; SPEAK.keep = u;
  let started = false, retried = false; u.addEventListener('start', () => { started = true; });
  const go = () => { SPEAK.retrying = null; if (!ok()) return; try { ss.resume(); ss.speak(u); } catch (e) {} };
  const wait = SPEAK.cancelAt + 150 - performance.now();
  if (ss.speaking || ss.pending) { ss.cancel(); setTimeout(go, 150); } else if (wait > 0) setTimeout(go, wait); else go();
  // nothing happened? clear the jammed queue and try once more
  setTimeout(() => { if (!started && !retried && ok()) { retried = true; SPEAK.retrying = u; ss.cancel(); setTimeout(go, 150); } }, 2500);
  clearInterval(SPEAK.ka);
  if (SPEAK.chrome && !SPEAK.ios) SPEAK.ka = setInterval(() => { if (!ss.speaking) clearInterval(SPEAK.ka); else { ss.pause(); ss.resume(); } }, 9000);
}
let voiceBusy = false, lastCallout = -99;
// driver callouts: only when nothing else is being announced, and not too often
function sayIfFree(id, opts = {}, gap = 7) {
  if (voiceBusy || G.t - lastCallout < gap) return false;
  lastCallout = G.t; say(id, opts); return true;
}
function say(id, opts = {}) {
  const parts = ['ja', 'en'].map(l => renderFor(id, l, opts.station)).filter(Boolean);
  if (!parts.length) { opts.cb && opts.cb(); return; }
  showSub(parts[0]?.text, parts[1]?.text);
  const seq = ++voiceSeq;
  voiceBusy = true;
  const done = () => { if (seq === voiceSeq) { voiceBusy = false; opts.cb && opts.cb(); } };
  if (muted) { setTimeout(done, 1500); return; }
  voiceEl.pause(); stopSpeech();
  playParts(parts, 0, seq, done);
}
/* iOS only lets speech (and <audio>) start later on if one was started inside a tap,
   so the first tap speaks a silent word. Missing mp3 files are remembered and skipped. */
let voiceUnlocked = false;
const NOFILE = new Set();
function unlockVoice() {
  if (voiceUnlocked) return; voiceUnlocked = true;
  // only iPad/iPhone need it; on a computer the silent word can jam the speech queue
  if (SPEAK.ios) try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  if (!jaVoice || !enVoice) pickVoices();
}
let jaVoice = null, enVoice = null;
function pickVoices() {
  try {
    const vs = speechSynthesis.getVoices();
    jaVoice = vs.find(v => /ja/i.test(v.lang) && /Kyoko|O-ren|Hattori/i.test(v.name)) || vs.find(v => /^ja/i.test(v.lang)) || null;
    enVoice = vs.find(v => /en-US/i.test(v.lang) && /Samantha|Ava|Allison/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null;
  } catch (e) {}
}
try { pickVoices(); speechSynthesis.onvoiceschanged = pickVoices; } catch (e) {}
function playParts(parts, i, seq, done) {
  if (seq !== voiceSeq) return;
  if (i >= parts.length) { done(); return; }
  const p = parts[i];
  const next = () => setTimeout(() => playParts(parts, i + 1, seq, done), 350);
  let fell = false;
  const tts = () => {
    if (fell || seq !== voiceSeq) return; fell = true;
    if (!window.speechSynthesis) { setTimeout(next, 1200); return; }
    const v = SCRIPTS.voices?.[p.role] || {};
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = p.lang === 'ja' ? 'ja-JP' : 'en-US'; u.rate = v.rate || 1; u.pitch = v.pitch || 1;
    const vo = p.lang === 'ja' ? jaVoice : enVoice; if (vo) u.voice = vo;
    let fired = false; const fin = () => { if (!fired) { fired = true; next(); } };
    u.onend = u.onerror = () => { if (SPEAK.retrying !== u) fin(); }; setTimeout(fin, 4500 + p.text.length * (p.lang === 'ja' ? 260 : 110));
    speakNow(u, () => !fired && seq === voiceSeq);
  };
  if (!p.file || NOFILE.has(p.file)) { tts(); return; }
  const miss = () => { if (seq === voiceSeq && voiceEl.error) NOFILE.add(p.file); tts(); };
  voiceEl.onended = next; voiceEl.onerror = miss;
  voiceEl.src = p.file; voiceEl.currentTime = 0;
  voiceEl.play().catch(miss);
}

/* ═══ UI HELPERS ═══ */
function tap(el, f) {
  let touched = false;
  el.addEventListener('touchstart', e => { e.preventDefault(); touched = true; el.classList.add('press'); initA(); f(e); }, { passive: false });
  el.addEventListener('touchend', e => { e.preventDefault(); el.classList.remove('press'); }, { passive: false });
  el.addEventListener('touchcancel', () => el.classList.remove('press'));
  el.addEventListener('click', e => { if (touched) { touched = false; return; } initA(); f(e); });
}
function hold(el, down, up) {
  el.addEventListener('touchstart', e => { e.preventDefault(); el.classList.add('press'); initA(); down(e); }, { passive: false });
  const end = e => { e.preventDefault && e.preventDefault(); el.classList.remove('press'); up(e); };
  el.addEventListener('touchend', end, { passive: false }); el.addEventListener('touchcancel', end);
  el.addEventListener('mousedown', e => { initA(); down(e); }); el.addEventListener('mouseup', up); el.addEventListener('mouseleave', up);
}
let msgT = null;
function bigMsg(html, ms = 1800) {
  const m = $('msg'); m.innerHTML = html; m.classList.add('show');
  clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('show'), ms);
}

/* ═══ OPTIONAL REAL SOUND FILES ═══
   train_205_scripts.json → "sfx": { name: "audio/train-205/sfx/name.mp3" }.
   A file that loads replaces the synthesised sound; a missing file is ignored. */
const SFXF = {};
function loadSfxFiles() {
  if (loadSfxFiles.done) return; loadSfxFiles.done = true;
  for (const [k, file] of Object.entries(SCRIPTS.sfx || {})) {
    const el = new Audio(); el.preload = 'auto';
    const rec = { el, ok: false }; SFXF[k] = rec;
    el.addEventListener('canplaythrough', () => { rec.ok = true; }, { once: true });
    el.addEventListener('error', () => { rec.ok = false; }, { once: true });
    el.src = file; el.load();
  }
}
function playFile(name, vol = 1, loop = false) {
  const f = SFXF[name]; if (!f || !f.ok || muted) return null;
  const el = loop ? f.el : f.el.cloneNode(); el.volume = clamp(vol, 0, 1); el.loop = loop; el.currentTime = 0; el.play().catch(() => {});
  return el;
}
