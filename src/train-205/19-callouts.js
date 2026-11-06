/* ═══ CALLOUTS: the driver's friendly voice + the yellow-signal game ═══
   Callouts never interrupt a station announcement (sayIfFree).               */
const CO = { done: {}, caution: [], cautionState: null, wasFast: true, tunnelIn: false, swPassed: {}, huOsc: null };
function planCaution() {
  // a few block signals on our side show yellow (a train ahead!) as we come up to them
  R = mulberry(12345);
  const blocks = SIGNALS.filter(sg => sg.facing > 0 && sg.kind === 'block' && !STATIONS.some(st => Math.abs(st.s - sg.s) < 500));
  CO.caution = [];
  for (let i = 0; i < blocks.length && CO.caution.length < 4; i += Math.max(2, Math.floor(blocks.length / 4))) CO.caution.push(blocks[i]);
  CO.caution.forEach(sg => { sg.caution = true; });
}
function resetCallouts() {
  CO.done = {}; CO.cautionState = null; CO.tunnelIn = false; CO.swPassed = {};
  SIGNALS.forEach(sg => { sg.cautionDone = false; });
}
function updateCallouts(dt, train) {
  const s = train.s, going = DRV.state === 'go' && train.v > 3, reg = G.mode === 'regular';
  // ── yellow signal: slow down, then praise ──
  if (reg) {
    const sg = CO.caution.find(c => !c.cautionDone && c.s > s && c.s - s < 560);
    if (sg && going && CO.cautionState !== sg) {
      CO.cautionState = sg; CO.slowedFor = null;
      bigMsg('Yellow signal! 🟡<small>Press Slow 🐢</small>', 2400);
      say('yellow_signal'); lastCallout = G.t;
      if (DRV.fast) $('b-fast').classList.add('hint');
    }
    if (CO.cautionState && CO.cautionState.s > s && !DRV.fast && CO.slowedFor !== CO.cautionState) {
      CO.slowedFor = CO.cautionState; $('b-fast').classList.remove('hint');
      bigMsg('Good job! 👍<small>Nice and slow</small>', 1800); say('slow_good'); lastCallout = G.t;
    }
    if (CO.cautionState && s > CO.cautionState.s + 5) {
      CO.cautionState.cautionDone = true; CO.cautionState = null; $('b-fast').classList.remove('hint');
      setTimeout(() => { if (G.running && G.mode === 'regular') { bigMsg('Green signal! 🟢<small>Fast is OK again 🐇</small>', 2000); sayIfFree('green_again', {}, 3); } }, 2500);
    }
  }
  // ── tunnels, big bridges, crossings, Shinkansen ──
  if (going) {
    for (const t of FEAT.tunnels) if (t.a - s > 120 && t.a - s < 380 && !CO.done['t' + t.a]) { if (sayIfFree('tunnel')) CO.done['t' + t.a] = 1; }
    for (const r of FEAT.rivers) if (r.water > 60 && r.s - r.half - s > 80 && r.s - r.half - s < 300 && !CO.done['r' + r.s]) { if (sayIfFree('bridge')) { CO.done['r' + r.s] = 1; bigMsg(`${r.en}! 🌉<small>${r.name}</small>`, 2200); } }
    for (const c of FEAT.crossings) if (c.s - s > 150 && c.s - s < 360 && !CO.done['c' + c.s]) { if (sayIfFree('crossing_horn', {}, 5)) { CO.done['c' + c.s] = 1; $('b-horn').classList.add('hint'); setTimeout(() => $('b-horn').classList.remove('hint'), 3500); } }
  }
  if (ZOOM.active && !CO.done['z' + ZOOM.nextT] && Math.abs(ZOOM.s - s) < 300) { if (sayIfFree('shinkansen', {}, 4)) CO.done['z' + ZOOM.nextT] = 1; }
  // ── sounds: entering a tunnel (boom), rolling over switches (clack-clack) ──
  const inT = !!tunnelAt(s);
  if (inT && !CO.tunnelIn && train.v > 5) noisy(1.2, .25, 160, .7);
  CO.tunnelIn = inT;
  for (const sw of SWITCHES) {
    if (Math.abs(sw.off - train.off) > .2 || CO.swPassed[sw.s]) continue;
    if (s > sw.s && s < sw.s + 40 && train.v > 2) {
      CO.swPassed[sw.s] = 1;
      for (let k = 0; k < 6; k++) { const w = k * 2.1 / Math.max(train.v, 1) + (k > 2 ? 13.9 / Math.max(train.v, 1) : 0); noisy(.06, .3, 1300, 1.6, w); tone(220, .05, 'square', .06, 120, w); }
    }
  }
  // ── HU300 motor whine when it is close to the camera ──
  if (A && RC.on && RC.racer) {
    if (!CO.huOsc) {
      const o = A.createOscillator(), g = A.createGain(), f = A.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'bandpass'; f.Q.value = 4;
      g.gain.value = 0; o.connect(f); f.connect(g); g.connect(master); o.start(); CO.huOsc = { o, g, f };
    }
    const d = RC.racer.pos(_coV).distanceTo(W.camera.position), v = RC.racer.v;
    const vol = v > .5 ? .05 * clamp(1 - d / 140, 0, 1) : 0;
    CO.huOsc.g.gain.setTargetAtTime(vol, A.currentTime, .2);
    CO.huOsc.o.frequency.setTargetAtTime(160 + v * 24, A.currentTime, .1); CO.huOsc.f.frequency.setTargetAtTime(500 + v * 40, A.currentTime, .1);
  } else if (CO.huOsc) CO.huOsc.g.gain.setTargetAtTime(0, A.currentTime, .1);
}
const _coV = new THREE.Vector3();
function trainSoundEnv(train) {
  const r = riverAt(train.s - 20);
  return { tunnel: !!tunnelAt(train.s - 20), bridge: !!(r && r.water > 30 && Math.abs(train.s - 20 - r.s) < r.half) };
}
