/* ═══ TRAIN SOUNDS (synthesised) ═══ */
const SND = { on: false };
function startTrainSound() {
  if (!A || SND.on) return; SND.on = true;
  const out = A.createGain(); out.gain.value = .9; out.connect(master); SND.out = out;
  // motor hum (DC traction motor) + gear whine
  const m1 = A.createOscillator(); m1.type = 'sawtooth';
  const m1f = A.createBiquadFilter(); m1f.type = 'lowpass'; m1f.frequency.value = 400; m1f.Q.value = 2;
  const m1g = A.createGain(); m1g.gain.value = 0; m1.connect(m1f); m1f.connect(m1g); m1g.connect(out);
  const m2 = A.createOscillator(); m2.type = 'sine';
  const m2g = A.createGain(); m2g.gain.value = 0; m2.connect(m2g); m2g.connect(out);
  const m3 = A.createOscillator(); m3.type = 'triangle';
  const m3g = A.createGain(); m3g.gain.value = 0; m3.connect(m3g); m3g.connect(out);
  // rolling noise
  const rn = A.createBufferSource(); rn.buffer = getNoise(); rn.loop = true;
  const rf = A.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 500;
  const rg = A.createGain(); rg.gain.value = 0; rn.connect(rf); rf.connect(rg); rg.connect(out);
  // compressor hum when stopped (コンプレッサー)
  const cp = A.createOscillator(); cp.type = 'square'; cp.frequency.value = 48;
  const cpf = A.createBiquadFilter(); cpf.type = 'lowpass'; cpf.frequency.value = 160;
  const cpg = A.createGain(); cpg.gain.value = 0; cp.connect(cpf); cpf.connect(cpg); cpg.connect(out);
  [m1, m2, m3, rn, cp].forEach(o => o.start());
  Object.assign(SND, { m1, m1f, m1g, m2, m2g, m3, m3g, rf, rg, cpg, jointAcc: 0 });
}
function stopTrainSound() {
  if (!SND.on) return; SND.on = false;
  try { SND.out.gain.setTargetAtTime(0, A.currentTime, .05); const o = SND.out; setTimeout(() => o.disconnect(), 300); } catch (e) {}
  ['m1', 'm2', 'm3', 'cp'].forEach(k => { try { SND[k] && SND[k].stop(); } catch (e) {} });
}
function updateTrainSound(dt, v, power, braking, inside, env = {}) {
  if (!SND.on) return;
  const t = A.currentTime, kmh = v * 3.6;
  const p = power ? 1 : 0;
  SND.m1.frequency.setTargetAtTime(28 + kmh * 1.6, t, .1);
  SND.m1f.frequency.setTargetAtTime(220 + kmh * 9, t, .1);
  SND.m1g.gain.setTargetAtTime(v > .2 ? (.035 + .05 * p) * Math.min(1, kmh / 15) : 0, t, .15);
  SND.m2.frequency.setTargetAtTime(90 + kmh * 13.5, t, .1);
  SND.m2g.gain.setTargetAtTime(v > .2 ? (.012 + .03 * p) * Math.min(1, kmh / 20) : 0, t, .15);
  SND.m3.frequency.setTargetAtTime(180 + kmh * 27, t, .1);
  SND.m3g.gain.setTargetAtTime(v > .2 ? .006 + .012 * p : 0, t, .15);
  // tunnels echo (louder, boomier); truss bridges rumble
  const tun = env.tunnel ? 1 : 0, br = env.bridge ? 1 : 0;
  SND.rf.frequency.setTargetAtTime((250 + kmh * 9) * (tun ? .6 : 1) * (br ? .7 : 1), t, .2);
  SND.rg.gain.setTargetAtTime(Math.min(.16, v * .006) * (inside ? .7 : 1) * (1 + 1.2 * tun + .8 * br), t, .2);
  SND.cpg.gain.setTargetAtTime(v < .3 ? .025 : 0, t, .4);
  // rail joints every 25 m: "ta-tan … ta-tan"
  SND.jointAcc += v * dt;
  if (SND.jointAcc >= 25) {
    SND.jointAcc -= 25;
    const g = Math.min(.5, .12 + v * .012);
    for (const d of [0, 2.1, 13.9, 16.0, 20.5 + 0, 20.5 + 2.1]) {
      const w = d / Math.max(v, .5); if (w > 2.5) continue;
      const lowF = env.bridge ? .55 : 1;
      noisy(.07, g * (d > 18 ? .5 : 1) * (env.bridge ? 1.6 : 1), 900 * lowF, 1.4, w); tone(140 * lowF, .06, 'triangle', g * .35, 90 * lowF, w);
    }
  }
}
/* horn: held while the button is pressed (空気笛 + 電子ホーン mix) */
const HORN = { nodes: null };
function hornOn() {
  if (!A || HORN.nodes || HORN.file) return;
  const hf = playFile('horn', 1, true); if (hf) { HORN.file = hf; HORN.t0 = performance.now(); return; }
  const t = A.currentTime, g = A.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .06); g.connect(master);
  const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .7; f.connect(g);
  const os = [349, 440, 523].map((fr, i) => { const o = A.createOscillator(); o.type = i === 2 ? 'square' : 'sawtooth'; o.frequency.value = fr; o.frequency.setValueAtTime(fr * .97, t); o.frequency.linearRampToValueAtTime(fr, t + .12);
    const og = A.createGain(); og.gain.value = i === 2 ? .2 : .5; o.connect(og); og.connect(f); o.start(t); return o; });
  HORN.nodes = { g, os }; HORN.t0 = performance.now();
}
function hornOff() {
  if (HORN.file) { const f = HORN.file; HORN.file = null; setTimeout(() => f.pause(), Math.max(0, 600 - (performance.now() - HORN.t0))); return; }
  if (!HORN.nodes) return;
  const n = HORN.nodes; HORN.nodes = null;
  const minHold = Math.max(0, 450 - (performance.now() - HORN.t0));
  setTimeout(() => { const t = A.currentTime; n.g.gain.setTargetAtTime(0, t, .07); setTimeout(() => n.os.forEach(o => { try { o.stop(); } catch (e) {} }), 500); }, minHold);
}
function sfx(name) {
  if (!A) return;
  if (playFile(name)) return;
  switch (name) {
    case 'click': tone(900, .05, 'square', .05); break;
    case 'wiper': noisy(.35, .05, 2400, .8); break;
    case 'air': noisy(.9, .14, 3000, .5, 0, 'highpass'); break;       // brake air release "pshh"
    case 'squeal': tone(2600, .8, 'sine', .03, 2450); tone(3900, .6, 'sine', .015, 3800); break;
    case 'arrive': [784, 988, 1175, 1568].forEach((f, i) => tone(f, .35, 'triangle', .1, null, i * .12)); break;
    case 'switch': tone(520, .06, 'square', .06); tone(780, .08, 'square', .05, null, .06); break;
    case 'doorOpen': noisy(1.1, .16, 2600, .4, 0, 'highpass'); tone(1318, .5, 'sine', .07, null, .15); tone(1046, .6, 'sine', .07, null, .5); break;
    case 'doorChime': // three-tone door chime, twice
      for (const rep of [0, .95]) [[1175, 0], [988, .22], [784, .44]].forEach(([f, t]) => { tone(f, .5, 'sine', .09, null, rep + t); tone(f * 2, .25, 'sine', .02, null, rep + t); });
      break;
    case 'tram': [0, .32].forEach(t => { tone(1568, .5, 'sine', .1, null, t); tone(2093, .35, 'sine', .05, null, t); }); break;
    case 'doorThump': noisy(.18, .25, 300, 1); tone(90, .15, 'sine', .15); break;
  }
}

/* departure melodies (発車メロディ): an original short tune for every station */
const MELODIES = [
  [72, 76, 79, 84, 79, 76, 77, 81, 84, 79],      // Tokyo
  [67, 72, 74, 76, 74, 72, 69, 72, 76],          // Ueno
  [76, 74, 72, 74, 76, 76, 76, 74, 74, 74],      // Akabane
  [72, 74, 76, 79, 81, 79, 76, 74, 72],          // Urawa
  [79, 84, 83, 81, 79, 76, 77, 79, 84],          // Omiya
  [69, 72, 76, 74, 72, 69, 67, 69],              // Kuki
  [74, 77, 81, 79, 77, 74, 76, 77],              // Koga
  [72, 76, 74, 77, 76, 79, 77, 81, 84],          // Oyama
  [76, 72, 74, 79, 76, 74, 72],                  // Ishibashi
  [79, 76, 72, 76, 79, 84, 81, 84, 88],          // Utsunomiya
];
function playMelody(i) {
  const fm = playFile('melody_' + STATIONS[i].id);
  if (fm) return isFinite(fm.duration) && fm.duration > 0 ? fm.duration + .3 : 6;
  const notes = MELODIES[i % MELODIES.length], step = .32;
  if (A) notes.forEach((n, k) => {
    const f = 440 * Math.pow(2, (n - 69) / 12), t = k * step, last = k === notes.length - 1;
    tone(f, last ? 1.0 : .45, 'triangle', .08, null, t); tone(f * 2, last ? .6 : .25, 'sine', .03, null, t); tone(f / 2, .4, 'sine', .03, null, t);
  });
  return notes.length * step + .9;
}
