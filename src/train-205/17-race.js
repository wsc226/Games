/* ═══ RACING MODE: 205 series vs HU300, Omiya → Utsunomiya ═══
   The race is scripted to be exciting: the HU300 jumps ahead, falls back, vanishes
   on its own track and comes back. The result is planned at the start: the 205
   wins most races, the HU300 wins about 1 in 3-4, never twice in a row.          */
const RC = { racer: null, on: false, started: false, done: false, plan: 'win', startS: 0, finishS: 0,
  lead: null, msgT: -99, closeT: 0, hidden: false, finalSaid: false, first: null, countT: 0 };
function raceHistory() { try { return JSON.parse(localStorage.getItem('t205Races') || '[]'); } catch (e) { return []; } }
function saveRace(r) { try { const h = raceHistory(); h.push(r); localStorage.setItem('t205Races', JSON.stringify(h.slice(-20))); } catch (e) {} }
function buildRacer() {
  RC.racer = new HU300(W.scene); RC.racer.root.visible = false;
  // front section shows white lights, the rear section red
  RC.racer.secs[0].lamps.forEach(l => { l.r.visible = false; });
  RC.racer.secs[2].lamps.forEach(l => { l.w.visible = false; });
}
function startRace() {
  const st = ST('omiya');
  RC.on = true; RC.started = false; RC.done = false; RC.first = null; RC.want = 30; RC.msgT = G.t; RC.lead = null; RC.hidden = false; RC.finalSaid = false;
  RC.startS = st.stopS; RC.finishS = STATIONS[STATIONS.length - 1].stopS;
  const h = raceHistory();
  RC.plan = h[h.length - 1] === 'L' ? 'win' : (Math.random() < .28 ? 'lose' : 'win');
  RC.racer.s = st.stopS + 1.5; RC.racer.v = 0; RC.racer.root.visible = true; RC.racer.place();
  train.s = st.stopS; train.v = 0;
  Object.assign(DRV, { state: 'stopped', atSt: -1, nextIdx: st.idx + 1, doors: 'closed', doorK: 0, announced: {}, leftFrom: -1 });
  $('race-hud').classList.remove('gone'); $('top').classList.add('gone'); $('result').classList.remove('show');
  CAM.az = -38; CAM.el = 13; CAM.dist = 46; setView('outside');
  // countdown
  $('b-go').classList.add('dis');
  say('race_intro', { cb: () => {
    let n = 3;
    const step = () => {
      if (!RC.on) return;
      if (n > 0) { countdown(String(n), n === 3 ? '#ff3b30' : n === 2 ? '#ffb21a' : '#ffe14a'); tone(660, .25, 'square', .1); n--; setTimeout(step, 1000); }
      else {
        countdown('GO!', '#35e96b'); tone(1320, .6, 'square', .12); sfx('tram');
        RC.started = true; $('b-go').classList.remove('dis'); $('b-go').classList.add('hint'); say('race_go');
        setTimeout(() => $('b-go').classList.remove('hint'), 4000);
      }
    };
    step();
  } });
}
function countdown(txt, col) {
  const c = $('countdown'); c.textContent = txt; c.style.color = col; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
}
function stopRace() { RC.on = false; if (RC.racer) RC.racer.root.visible = false; $('race-hud').classList.add('gone'); $('top').classList.remove('gone'); $('result').classList.remove('show'); }
function desiredGap(p) {
  // positive = HU300 ahead of the 205
  if (p < .1) return 30;
  if (p < .32) return lerp(30, -35, smooth((p - .1) / .1));
  if (p < .55) return lerp(-35, 32, smooth((p - .32) / .1));
  if (p < .8) return 12 * Math.sin(p * 60);
  return RC.plan === 'win' ? lerp(0, -70, smooth((p - .8) / .12)) : lerp(0, 45, smooth((p - .8) / .12));
}
function updateRace(dt) {
  if (!RC.on) return;
  const T = train, H = RC.racer;
  if (RC.started && !RC.done) {
    const p = clamp((T.s - RC.startS) / (RC.finishS - RC.startS), 0, 1);
    RC.want = damp(RC.want ?? 0, desiredGap(p), 1.2, dt);
    const gap = H.s - T.s;
    let v = clamp(T.v + .45 * (RC.want - gap), 0, 38);
    const toGo = RC.finishS - H.s; v = Math.min(v, Math.sqrt(2 * 1.3 * Math.max(toGo, 0)));
    H.v = v > H.v ? Math.min(v, H.v + 2.0 * dt) : Math.max(v, H.v - 2.6 * dt);
    H.s = Math.min(H.s + H.v * dt, RC.finishS);
    // who gets to the finish first
    if (!RC.first && H.s >= RC.finishS - .5) RC.first = 'hu';
    if (!RC.first && T.s >= RC.finishS - 1) RC.first = '205';
    // commentary
    const lead = gap > 8 ? 'hu' : gap < -8 ? '205' : RC.lead;
    if (lead !== RC.lead && G.t - RC.msgT > 10 && p > .02 && p < .95) {
      RC.msgT = G.t;
      if (lead === '205') { bigMsg('The 205 is ahead! 🟢', 1800); say('race_lead_205'); } else { bigMsg('The HU300 is ahead! 🟡', 1800); say('race_lead_hu300'); }
    }
    RC.lead = lead;
    if (Math.abs(gap) < 6 && T.v > 8) { RC.closeT += dt; if (RC.closeT > 4 && G.t - RC.msgT > 25) { RC.msgT = G.t; RC.closeT = 0; bigMsg('So close! 😮', 1600); say('race_close'); } } else RC.closeT = 0;
    const far = Math.abs(raceOff(H.s - 14)) > 70;
    if (far && !RC.hidden) { RC.hidden = true; RC.msgT = G.t; bigMsg('Where did the HU300 go? 👀', 2200); say('race_hidden'); }
    if (!far && RC.hidden && Math.abs(raceOff(H.s - 14)) < 30) { RC.hidden = false; RC.msgT = G.t; bigMsg('There it is! 👋', 1800); say('race_back'); }
    if (!RC.finalSaid && RC.finishS - Math.max(T.s, H.s) < 1100) { RC.finalSaid = true; say('race_final'); }
    // race over once both have arrived (or the 205 has stopped at the end)
    if (RC.first && T.s >= RC.finishS - 1.5 && DRV.state === 'stopped') finishRace();
    if (RC.first === 'hu' && T.s >= RC.finishS - 1.5 && T.v < .2) finishRace();
  } else if (!RC.started) { H.v = 0; }
  H.place();
  $('race-pos').textContent = (H.s - T.s) > 2 ? '2nd' : '1st';
  $('race-pos').className = (H.s - T.s) > 2 ? 'second' : 'first';
  $('race-dist').textContent = Math.max(0, (RC.finishS - T.s) / 1000).toFixed(1) + ' km to go';
}
function finishRace() {
  if (RC.done) return; RC.done = true;
  const win = RC.first === '205';
  saveRace(win ? 'W' : 'L');
  setTimeout(() => {
    $('res-t').textContent = win ? 'You win! 🏆' : 'HU300 wins!';
    $('res-s').textContent = win ? 'The 205 series got to Utsunomiya first!' : 'So close! Let\'s race again!';
    $('result').className = 'show ' + (win ? 'win' : 'lose');
    say(win ? 'race_win' : 'race_lose');
    if (win) { sfx('arrive'); confetti(); }
  }, 1200);
}
function confetti() {
  const box = $('confetti'); box.innerHTML = '';
  const cols = ['#ffbe12', '#1f9a48', '#f08a24', '#3a78d8', '#e8443a', '#fff'];
  for (let i = 0; i < 90; i++) {
    const d = document.createElement('i'); d.style.left = Math.random() * 100 + '%'; d.style.background = cols[i % cols.length];
    d.style.animationDelay = Math.random() * 1.2 + 's'; d.style.animationDuration = 2.2 + Math.random() * 1.6 + 's'; box.appendChild(d);
  }
}

/* ── mini map: the whole line, the 205 (green) and the HU300 (yellow) ── */
const MAP = { pts: null, rpts: null, xf: null };
function buildMinimap() {
  const c = $('minimap'), Wc = c.width, Hc = c.height;
  const a = posAt(0, 0, 0), b = posAt(TRACK.len, 0, 0), ang = Math.atan2(b.z - a.z, b.x - a.x);
  const rot = (x, z) => [(x - a.x) * Math.cos(-ang) - (z - a.z) * Math.sin(-ang), (x - a.x) * Math.sin(-ang) + (z - a.z) * Math.cos(-ang)];
  const raw = [], rraw = [];
  for (let s = 0; s <= TRACK.len; s += 40) { const p = posAt(s, 0, 0); raw.push(rot(p.x, p.z)); const q = posAt(s, raceOff(s), 0); rraw.push(rot(q.x, q.z)); }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of raw.concat(rraw)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = 26, sc = Math.min((Wc - pad * 2) / (x1 - x0), (Hc - pad * 2) / Math.max(1, y1 - y0));
  const ox = pad - x0 * sc + ((Wc - pad * 2) - (x1 - x0) * sc) / 2, oy = pad - y0 * sc + ((Hc - pad * 2) - (y1 - y0) * sc) / 2;
  MAP.xf = (x, z) => { const [u, v] = rot(x, z); return [ox + u * sc, oy + v * sc]; };
  MAP.pts = raw.map(([u, v]) => [ox + u * sc, oy + v * sc]); MAP.rpts = rraw.map(([u, v]) => [ox + u * sc, oy + v * sc]);
}
const _mp = new THREE.Vector3();
function drawMinimap() {
  const c = $('minimap'), g = c.getContext('2d'), Wc = c.width, Hc = c.height;
  g.clearRect(0, 0, Wc, Hc);
  g.fillStyle = 'rgba(10,20,14,.78)'; rrect(g, 0, 0, Wc, Hc, 26); g.fill();
  const line = (pts, col, w, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (RC.on) line(MAP.rpts, 'rgba(255,190,18,.55)', 4, [8, 8]);
  line(MAP.pts, '#dfe8e2', 6);
  if (RC.on) { const i0 = Math.floor(RC.startS / 40); line(MAP.pts.slice(i0), '#7fe39a', 6); }
  g.font = 'bold 15px -apple-system,Arial'; g.textAlign = 'center';
  for (const st of STATIONS) {
    const p = posAt(st.s, 0, 0, _mp), [x, y] = MAP.xf(p.x, p.z);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    if (st.big || st.idx === STATIONS.length - 1) { g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(st.en, x, y + (st.idx % 2 ? -12 : 22)); }
  }
  const dot = (p, col) => { const [x, y] = MAP.xf(p.x, p.z); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); };
  if (RC.on) dot(RC.racer.pos(_mp), '#ffbe12');
  dot(posAt(train.s - 30, train.off, 0, _mp), '#1fbf55');
}
