/* ═══ DRIVING ═══
   Go / Stop  : Go accelerates to the chosen speed; Stop brakes to a halt in 2 s.
   Fast / Slow: target speed.                                                   */
const DRV = {
  train: null, state: 'stopped',     // 'stopped' | 'go' | 'braking'
  fast: true, brakeDecel: 0, accel: 1.5,
  FAST: 30, SLOW: 15,                // m/s  (108 km/h / 54 km/h)
  nextIdx: 1, arrivedAt: 0,
  atSt: -1,                          // index of the station whose platform we are stopped at
  doors: 'closed', doorK: 0,         // 'closed' | 'opening' | 'open' | 'melody' | 'closing'
  announced: {}, leftFrom: -1, hintT: null,
};
function targetSpeed() { return DRV.fast ? (G.mode === 'race' ? 33 : DRV.FAST) : DRV.SLOW; }
function nextStation() { return STATIONS[Math.min(DRV.nextIdx, STATIONS.length - 1)]; }
function refreshNext() {
  const st = nextStation();
  $('nx-ja').textContent = st.en; $('nx-en').textContent = st.ja + (st.no ? '  ' + st.no : '');
}
function setGoButton() {
  const b = $('b-go'), moving = DRV.state === 'go';
  b.className = 'cb ' + (moving ? 'stop' : 'go');
  b.innerHTML = moving ? '<i>■</i><b>Stop</b>' : '<i>▶</i><b>Go</b>';
}
function pressGo() {
  if (G.mode === 'race' && (!RC.started || RC.done)) return;
  if (DRV.doors !== 'closed') {
    bigMsg('Close the doors first! 🚪<small>ドアを しめてね</small>', 2000);
    say('close_doors_first');
    const d = $('b-door'); d.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 400, iterations: 2 });
    return;
  }
  if (DRV.state === 'aligning') return;
  if (DRV.state === 'go') { // → stop in 2 seconds
    DRV.state = 'braking'; DRV.brakeDecel = Math.max(DRV.train.v / 2, .5);
    if (DRV.train.v > 3) sfx('squeal');
  } else {
    if (DRV.train.s >= STATIONS[STATIONS.length - 1].stopS - 2) { bigMsg('End of the line!<small>しゅうてん</small>', 2200); return; }
    DRV.state = 'go';
    if (DRV.atSt >= 0) { DRV.leftFrom = DRV.atSt; DRV.atSt = -1; }
    clearTimeout(DRV.hintT); $('b-door').classList.remove('hint');
  }
  setGoButton();
}
function pressFast() {
  DRV.fast = !DRV.fast; const b = $('b-fast');
  b.className = 'cb ' + (DRV.fast ? 'fast' : 'slow');
  b.innerHTML = DRV.fast ? '<i>🐇</i><b>Fast</b>' : '<i>🐢</i><b>Slow</b>';
}
function updateDrive(dt) {
  const T = DRV.train;
  const end = STATIONS[STATIONS.length - 1].stopS;
  // automatic stop at the end of the line (buffer stop)
  const distEnd = end - T.s;
  if (DRV.state === 'go') {
    const need = T.v * T.v / (2 * 1.2);
    if (distEnd < need + 2) { DRV.state = 'braking'; DRV.brakeDecel = T.v * T.v / (2 * Math.max(distEnd, 1)); setGoButton(); }
  }
  if (DRV.state === 'go') {
    const tv = targetSpeed();
    if (T.v < tv) T.v = Math.min(tv, T.v + DRV.accel * dt * (T.v < 5 ? .8 : 1));
    else T.v = Math.max(tv, T.v - 1.0 * dt);
  } else if (DRV.state === 'braking') {
    T.v = Math.max(0, T.v - DRV.brakeDecel * dt);
    if (T.v <= 0) { DRV.state = 'stopped'; T.v = 0; sfx('air'); onStopped(); setGoButton(); }
  } else if (DRV.state === 'aligning') {
    // creep to line up the train doors with the platform screen doors
    const d = STATIONS[DRV.atSt].stopS - T.s;
    T.v = Math.sign(d) * clamp(Math.abs(d) * .6, .6, 7);
    if (Math.abs(d) < .05 || Math.abs(T.v * dt) >= Math.abs(d)) { T.s = STATIONS[DRV.atSt].stopS; T.v = 0; DRV.state = 'stopped'; sfx('air'); bigMsg('Lined up! 👍<small>Open the doors</small>', 1800); }
  }
  if (DRV.state !== 'aligning' || T.v) T.s = Math.min(T.s + T.v * dt, end + 1);
  // passed a station without stopping → aim for the next one
  while (DRV.nextIdx < STATIONS.length - 1 && T.s > nextStation().s + TRACK.PLAT_HALF + 5) {
    const missed = nextStation();
    DRV.nextIdx++; refreshNext();
    if (G.mode === 'regular') { bigMsg(`Oops! We passed ${missed.en}<small>Let's stop at ${nextStation().en}</small>`, 2600); say('passed_station'); }
  }
  // announcements on the way
  const st = nextStation();
  if (G.mode === 'regular' && DRV.state === 'go') {
    if (DRV.leftFrom >= 0 && T.v > 4 && !DRV.announced['next' + DRV.leftFrom]) {
      DRV.announced['next' + DRV.leftFrom] = 1; say('next', { station: STATIONS[DRV.leftFrom].id });
    }
    if (T.s > st.s - 750 && T.s < st.s - 200 && !DRV.announced['app' + st.idx]) {
      DRV.announced['app' + st.idx] = 1;
      const last = st.idx === STATIONS.length - 1;
      say(last ? 'approaching_last' : 'approaching', { station: st.id, cb: () => { if (st.transfer_ja) say('transfer', { station: st.id }); } });
    }
  }
  updateDoors(dt);
}
function atPlatform(st, s) { return s > st.s - TRACK.PLAT_HALF + 25 && s < st.s + TRACK.PLAT_HALF + 4; }
/* ── doors ── */
function doorsAllowed() { return DRV.state === 'stopped' && DRV.atSt >= 0 && (DRV.doors === 'closed' || DRV.doors === 'open'); }
function pressDoors() {
  if (!doorsAllowed()) return;
  clearTimeout(DRV.hintT); $('b-door').classList.remove('hint');
  const st = STATIONS[DRV.atSt];
  if (DRV.doors === 'closed') {
    DRV.doors = 'opening'; sfx('doorOpen');
    const last = st.idx === STATIONS.length - 1;
    setTimeout(() => say(last ? 'arrived_last' : st.idx === 0 ? 'doors_open' : 'arrived', { station: st.id }), 600);
  } else {
    // departure melody, then "the doors are closing", chime, close
    DRV.doors = 'melody';
    const len = playMelody(st.idx);
    if (CAM.view === 'platform') setTimeout(() => say('platform_departing'), 300);
    setTimeout(() => {
      if (DRV.doors !== 'melody') return;
      say('doors_close'); sfx('doorChime');
      setTimeout(() => { DRV.doors = 'closing'; freezeBoarders(); }, 900);
    }, len * 1000);
  }
}
function updateDoors(dt) {
  const T = DRV.train;
  if (DRV.doors === 'opening') {
    DRV.doorK = Math.min(1, DRV.doorK + dt / 2.0);
    if (DRV.doorK >= 1) { DRV.doors = 'open'; startPassengerFlow(STATIONS[DRV.atSt], T); }
  } else if (DRV.doors === 'closing') {
    DRV.doorK = Math.max(0, DRV.doorK - dt / 2.4);
    if (DRV.doorK <= 0) { DRV.doors = 'closed'; sfx('doorThump'); bigMsg('Doors closed!<small>Press Go ▶</small>', 1800); }
  }
  T.setDoors(DRV.doorK);
  if (DRV.atSt >= 0) setScreenDoors(STATIONS[DRV.atSt], DRV.doorK);
  // Doors button: grey unless stopped at a platform
  const ok = doorsAllowed(), b = $('b-door');
  if (b.classList.contains('dis') === ok) b.classList.toggle('dis', !ok);
  const lab = DRV.doors === 'open' ? 'Close' : 'Open';
  if (b.dataset.l !== lab) { b.dataset.l = lab; b.innerHTML = `<i>🚪</i><b>${lab} Doors</b>`; }
}
function onStopped() {
  if (G.mode !== 'regular') return;
  const st = nextStation(), T = DRV.train;
  // generous: anywhere with the front of the train alongside the platform counts
  if (T.s > st.s - TRACK.PLAT_HALF + 25 && T.s < st.s + TRACK.PLAT_HALF + 4) {
    const off = Math.abs(T.s - st.stopS);
    sfx('arrive');
    if (off < 6) bigMsg(`Perfect stop! ⭐<small>${st.en} · ${st.ja}</small>`, 2600);
    else bigMsg(`${st.en}!<small>Arrived · ${st.ja}</small>`, 2400);
    DRV.arrivedAt = st.idx; DRV.atSt = st.idx;
    if (st.psd && Math.abs(T.s - st.stopS) > .3) {
      DRV.state = 'aligning';
      setTimeout(() => bigMsg('Lining up with the screen doors…<small>ホームドアに あわせます</small>', 2400), 2500);
    }
    if (off < 6) setTimeout(() => say('perfect_stop'), 400);
    if (st.idx < STATIONS.length - 1) DRV.nextIdx = st.idx + 1;
    setTimeout(refreshNext, 2500);
    // hint: press the Doors button
    clearTimeout(DRV.hintT);
    DRV.hintT = setTimeout(() => { if (DRV.atSt === st.idx && DRV.doors === 'closed') { $('b-door').classList.add('hint'); bigMsg('Open the doors! 🚪<small>Press Doors</small>', 2200); } }, 3200);
  }
}

/* ── speedometer (white dial like the 205 cab gauge, 0-120 km/h) ── */
let _spdLast = -1;
function drawSpeedo(v) {
  // the needle only moves when the speed does: skip redrawing an identical dial
  const kq = Math.round(Math.abs(v) * 3.6 * 4) / 4; if (kq === _spdLast) return; _spdLast = kq;
  const c = $('speedo'), g = c.getContext('2d'), W2 = c.width, cx = W2 / 2, cy = W2 / 2, r = W2 / 2 - 10;
  g.clearRect(0, 0, W2, W2);
  g.fillStyle = '#26332d'; rrect(g, 4, 4, W2 - 8, W2 - 8, 34); g.fill();
  g.fillStyle = '#f8f8f4'; g.beginPath(); g.arc(cx, cy, r - 16, 0, Math.PI * 2); g.fill();
  const a0 = Math.PI * .75, a1 = Math.PI * 2.25, ang = k => a0 + (a1 - a0) * k / 120;
  g.strokeStyle = '#111'; g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k <= 120; k += 5) {
    const a = ang(k), big = k % 20 === 0;
    g.lineWidth = big ? 5 : 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22)); g.lineTo(cx + Math.cos(a) * (r - (big ? 44 : 34)), cy + Math.sin(a) * (r - (big ? 44 : 34))); g.stroke();
    if (big) { g.font = 'bold 26px Arial'; g.fillText(k, cx + Math.cos(a) * (r - 66), cy + Math.sin(a) * (r - 66)); }
  }
  g.font = 'bold 20px Arial'; g.fillText('km/h', cx, cy + 50);
  const kmh = v * 3.6, a = ang(clamp(kmh, 0, 120));
  g.strokeStyle = '#e8401c'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18); g.lineTo(cx + Math.cos(a) * (r - 40), cy + Math.sin(a) * (r - 40)); g.stroke();
  g.fillStyle = '#333'; g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#111'; g.font = 'bold 34px Menlo,monospace'; g.fillText(Math.round(kmh), cx, cy + 90);
}

function setupButtons() {
  const T = () => DRV.train;
  tap($('b-go'), pressGo);
  tap($('b-fast'), pressFast);
  tap($('b-lt'), () => { T().lights.on = !T().lights.on; $('b-lt').classList.toggle('on', T().lights.on); T().applyLights(); sfx('click'); });
  tap($('b-lc'), () => { const L = T().lights; L.color = L.color === 'white' ? 'red' : 'white'; if (!L.on) { L.on = true; $('b-lt').classList.add('on'); }
    $('b-lc').className = 'cb ' + L.color; $('b-lc-t').textContent = L.color === 'red' ? 'Red' : 'White'; T().applyLights(); sfx('click'); });
  tap($('b-wf'), () => { T().wiper.front = !T().wiper.front; $('b-wf').classList.toggle('on', T().wiper.front); sfx('click'); });
  tap($('b-wb'), () => { T().wiper.back = !T().wiper.back; $('b-wb').classList.toggle('on', T().wiper.back); sfx('click'); });
  hold($('b-horn'), hornOn, hornOff);
  tap($('b-door'), pressDoors);
  tap($('cam'), () => { nextView(); sfx('click'); });
  tap($('mute'), () => setMuted(!muted));
  // Home needs a short hold, so a stray tap from little fingers does not end the trip
  const hb = $('home'); let homeT = null;
  const homeDown = e => { e.preventDefault(); hb.classList.add('arming'); homeT = setTimeout(() => { hb.classList.remove('arming'); homeT = null; goHome(); }, 900); };
  const homeUp = () => { if (homeT) { clearTimeout(homeT); homeT = null; hb.classList.remove('arming'); bigMsg('Hold to go Home 🏠', 1200); } };
  hb.addEventListener('touchstart', homeDown, { passive: false }); hb.addEventListener('touchend', homeUp); hb.addEventListener('touchcancel', homeUp);
  hb.addEventListener('mousedown', homeDown); hb.addEventListener('mouseup', homeUp); hb.addEventListener('mouseleave', () => { if (homeT) { clearTimeout(homeT); homeT = null; hb.classList.remove('arming'); } });
}
